import { createClient } from "@supabase/supabase-js";

const url = process.env.V2_URL;
const key = process.env.V2_PUBLISHABLE_KEY;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
const password = process.env.PIE_TEST_PASSWORD;

if (!url || !key || !emailA || !emailB || !password) {
  throw new Error("Missing P15 certification environment");
}

const client = () => createClient(url, key, { auth: { persistSession: false } });
const A = client();
const B = client();

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++; else fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
}

async function login(c: ReturnType<typeof client>, email: string) {
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error("login failed: " + (error?.message ?? "no session"));
  return data;
}

async function invoke(c: ReturnType<typeof client>) {
  const { data: { session } } = await c.auth.getSession();
  if (!session) throw new Error("missing session");
  const response = await fetch(url + "/functions/v1/pie-p14-shadow-read", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.access_token, apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const unauth = await fetch(url + "/functions/v1/pie-p14-shadow-read", {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: "{}",
});
check("P15-01 unauthenticated PIE read is rejected", unauth.status === 401);

const a = await login(A, emailA);
const b = await login(B, emailB);
check("P15-02 authenticated identities are distinct", a.user.id !== b.user.id);

const aRead = await invoke(A);
check("P15-03 candidate A receives authenticated P14 response", aRead.response.ok && aRead.payload.status === "ready");
check("P15-04 candidate A receives exactly six dimensions", Array.isArray(aRead.payload.dimensions) && aRead.payload.dimensions.length === 6);
check("P15-05 P12 shadow security markers remain intact",
  aRead.payload.shadow_only === true &&
  aRead.payload.authoritative === false &&
  aRead.payload.influences_adaptation === false &&
  aRead.payload.model_version === "pie-inference-v2.1-shadow"
);
check("P15-06 P12 provenance remains intact",
  typeof aRead.payload.inference_hash === "string" &&
  aRead.payload.inference_hash.length === 64 &&
  typeof aRead.payload.source_state_version === "number"
);

const bRead = await invoke(B);
check("P15-07 candidate B receives authenticated P14 response", bRead.response.ok && bRead.payload.status === "ready", JSON.stringify({ http: bRead.response.status, status: bRead.payload.status, error: bRead.payload.error, read_source: bRead.payload.read_source }));
check("P15-08 cross-user inference isolation holds",
  a.user.id !== b.user.id && aRead.payload.inference_hash !== bRead.payload.inference_hash
);

const forged = await (async () => {
  const { data: { session } } = await A.auth.getSession();
  return fetch(url + "/functions/v1/pie-p14-shadow-read", {
    method: "POST",
    headers: { Authorization: "Bearer " + session!.access_token, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: b.user.id }),
  });
})();
const forgedPayload = await forged.json().catch(() => ({}));
check("P15-09 caller-supplied foreign user_id cannot change scope",
  forged.ok && forgedPayload.inference_hash === aRead.payload.inference_hash,
  JSON.stringify({ http: forged.status, status: forgedPayload.status, error: forgedPayload.error, read_source: forgedPayload.read_source })
);

const directProjection = await A.schema("pie").from("inference_projection").select("user_id").limit(1);
check("P15-10 browser cannot directly read protected projection", !!directProjection.error);
const directShadow = await A.schema("pie").from("inference_shadow").select("user_id").limit(1);
check("P15-11 browser cannot directly read protected shadow", !!directShadow.error);

const secondRead = await invoke(A);
check("P15-12 subsequent authenticated read remains projection-backed",
  secondRead.response.ok && secondRead.payload.read_source === "projection",
  JSON.stringify({ http: secondRead.response.status, status: secondRead.payload.status, error: secondRead.payload.error, read_source: secondRead.payload.read_source, observation_count: secondRead.payload.observation_count })
);
check("P15-13 P14 projection remains stable",
  secondRead.payload.inference_hash === aRead.payload.inference_hash,
  JSON.stringify({ first_hash: aRead.payload.inference_hash, second_hash: secondRead.payload.inference_hash })
);

await A.auth.signOut();
await B.auth.signOut();

console.log("");
console.log("P15 CONTROLLED PRODUCTION EXPOSURE SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);

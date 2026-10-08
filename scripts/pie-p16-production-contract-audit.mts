import { createClient } from "@supabase/supabase-js";

const url = process.env.V2_URL;
const key = process.env.V2_PUBLISHABLE_KEY;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const password = process.env.PIE_TEST_PASSWORD;
if (!url || !key || !emailA || !password) throw new Error("Missing P16 certification environment");

const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.auth.signInWithPassword({ email: emailA, password });
if (error || !data.session || !data.user) throw new Error("login failed: " + (error?.message ?? "no session"));

const invoke = async () => {
  const response = await fetch(url + "/functions/v1/pie-p14-shadow-read", {
    method: "POST",
    headers: { Authorization: "Bearer " + data.session!.access_token, apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++; else fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
};

const first = await invoke();
const p = first.payload as Record<string, unknown>;

check("P16-01 authenticated P14 read succeeds", first.response.ok && p.status === "ready");
check("P16-02 response is projection-backed", p.read_source === "projection");
check("P16-03 shadow security contract is exact",
  p.shadow_only === true && p.authoritative === false && p.influences_adaptation === false &&
  p.model_version === "pie-inference-v2.1-shadow"
);

const expected = new Set([
  "status","read_source","shadow_only","authoritative","influences_adaptation",
  "model_version","source_state_version","evidence_maturity","signal_quality",
  "explanation","inference_hash","inferred_at","observation_count","dimensions"
]);
const actual = Object.keys(p);
check("P16-04 response exposes only approved top-level fields",
  actual.every((k) => expected.has(k)) && expected.size === actual.length,
  "unexpected=" + actual.filter((k) => !expected.has(k)).join(",")
);

const forbiddenNames = ["user_id","access_token","service_role","serviceRole","password","payload","observations"];
const serialized = JSON.stringify(p);
check("P16-05 no identity, credential, or raw-observation fields are exposed",
  forbiddenNames.every((k) => !(k in p)) && !serialized.includes("SUPABASE_SERVICE_ROLE_KEY")
);

const dims = Array.isArray(p.dimensions) ? p.dimensions as Record<string, unknown>[] : [];
const allowedDim = new Set(["dimension","estimate","uncertainty","lower","upper","evidence_count","evidence_quality"]);
check("P16-06 each dimension exposes only the approved numerical contract",
  dims.length === 6 && dims.every((d) => Object.keys(d).every((k) => allowedDim.has(k)) && Object.keys(d).length === allowedDim.size)
);

check("P16-07 inference hash is canonical 64-character SHA-256",
  typeof p.inference_hash === "string" && /^[0-9a-f]{64}$/.test(p.inference_hash)
);

check("P16-08 six canonical dimensions are present",
  dims.length === 6 && new Set(dims.map((d) => d.dimension)).size === 6 &&
  ["capability","decision","timing","calibration","sustained_performance","learning"].every((d) => dims.some((x) => x.dimension === d))
);

const second = await invoke();
check("P16-09 repeated read remains projection-backed", second.response.ok && second.payload.read_source === "projection");
check("P16-10 repeated read preserves inference hash", second.payload.inference_hash === p.inference_hash);

const directProjection = await client.schema("pie").from("inference_projection").select("user_id").limit(1);
const directShadow = await client.schema("pie").from("inference_shadow").select("user_id").limit(1);
check("P16-11 authenticated browser cannot directly read projection", !!directProjection.error);
check("P16-12 authenticated browser cannot directly read shadow", !!directShadow.error);

await client.auth.signOut();
console.log("");
console.log("P16 PRODUCTION CONTRACT AUDIT SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);

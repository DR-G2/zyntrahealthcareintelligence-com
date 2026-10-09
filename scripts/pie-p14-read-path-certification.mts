import { createClient } from "@supabase/supabase-js";

const url = process.env.V2_URL;
const key = process.env.V2_PUBLISHABLE_KEY;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
const password = process.env.PIE_TEST_PASSWORD;

if (!url || !key || !emailA || !emailB || !password) throw new Error("Missing P14 certification environment");

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

async function invoke(c: ReturnType<typeof client>, body: Record<string, unknown> = {}) {
  const { data: { session } } = await c.auth.getSession();
  if (!session) throw new Error("missing session");
  const response = await fetch(url + "/functions/v1/pie-p14-shadow-read", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.access_token, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const a = await login(A, emailA);
const b = await login(B, emailB);
check("P14-01 authenticated identities are distinct", a.user.id !== b.user.id);

const aFirst = await invoke(A);
check("P14-02 authenticated candidate loads own shadow inference", aFirst.response.ok && aFirst.payload.status === "ready");
check("P14-03 six dimensions are present", Array.isArray(aFirst.payload.dimensions) && aFirst.payload.dimensions.length === 6);
check("P14-04 all required numerical fields are present", Array.isArray(aFirst.payload.dimensions) && aFirst.payload.dimensions.every((d: any) =>
  ["estimate", "uncertainty", "lower", "upper", "evidence_count", "evidence_quality"].every((k) => typeof d?.[k] === "number" && Number.isFinite(d[k]))
));
check("P14-05 shadow security markers are preserved",
  aFirst.payload.shadow_only === true &&
  aFirst.payload.authoritative === false &&
  aFirst.payload.influences_adaptation === false &&
  aFirst.payload.model_version === "pie-inference-v2.1-shadow"
);
check("P14-06 inference provenance is preserved", typeof aFirst.payload.inference_hash === "string" && aFirst.payload.inference_hash.length === 64);

const aSecond = await invoke(A);
check("P14-07 subsequent read is served from projection", aSecond.response.ok && aSecond.payload.read_source === "projection");
const normalizeDimensions = (dimensions: any[]) => dimensions
  .map((d) => ({
    dimension: d.dimension,
    estimate: d.estimate,
    uncertainty: d.uncertainty,
    lower: d.lower,
    upper: d.upper,
    evidence_count: d.evidence_count,
    evidence_quality: d.evidence_quality,
  }))
  .sort((a, b) => a.dimension.localeCompare(b.dimension));
check("P14-08 projection is stable across reads",
  aSecond.payload.inference_hash === aFirst.payload.inference_hash &&
  JSON.stringify(normalizeDimensions(aSecond.payload.dimensions)) === JSON.stringify(normalizeDimensions(aFirst.payload.dimensions))
);

const forged = await invoke(A, { user_id: b.user.id });
check("P14-09 foreign user_id cannot change authenticated scope", forged.response.ok && forged.payload.inference_hash === aSecond.payload.inference_hash);

const bRead = await invoke(B);
check("P14-10 second authenticated candidate gets own inference", bRead.response.ok && bRead.payload.status === "ready");
check("P14-11 cross-user inference is isolated", bRead.payload.inference_hash !== aSecond.payload.inference_hash || b.user.id === a.user.id);

const directProjection = await A.schema("pie").from("inference_projection").select("user_id").limit(1);
check("P14-12 authenticated browser cannot directly read projection table", !!directProjection.error);
const directShadow = await A.schema("pie").from("inference_shadow").select("user_id").limit(1);
check("P14-13 authenticated browser cannot directly read protected shadow table", !!directShadow.error);

const unauth = await fetch(url + "/functions/v1/pie-p14-shadow-read", {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: "{}",
});
check("P14-14 unauthenticated access is rejected", unauth.status === 401);

await A.auth.signOut();
await B.auth.signOut();

console.log("");
console.log("P14 PRODUCTION READ-PATH CERTIFICATION SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);

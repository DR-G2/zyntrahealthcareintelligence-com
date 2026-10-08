import { readFileSync } from "node:fs";

const serviceRole = process.env.SERVICE_ROLE;
const v2Url = process.env.V2_URL;
if (!serviceRole || !v2Url) throw new Error("Missing V2 service role or URL");

const sql = readFileSync("supabase/migrations_v2/0080_p12_shadow_inference_service_grants.sql", "utf8");
const base = v2Url.replace(/\/$/, "");
const ref = new URL(base).hostname.split(".")[0];

async function attempt(name, url, headers, body) {
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = (await response.text()).slice(0, 280);
  console.log(`ATTEMPT ${name} status=${response.status} body=${text}`);
  return response.ok;
}

const headers = {
  Authorization: `Bearer ${serviceRole}`,
  apikey: serviceRole,
  "Content-Type": "application/json",
};

const ok =
  (await attempt("management", `https://api.supabase.com/v1/projects/${ref}/database/query`, headers, { query: sql })) ||
  (await attempt("pg", `${base}/pg/query`, headers, { query: sql })) ||
  (await attempt("pg-meta", `${base}/pg-meta/default/query`, headers, { query: sql }));

if (!ok) {
  console.error("No service-role SQL endpoint accepted the grant migration");
  process.exit(1);
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.V2_URL;
const key = process.env.V2_PUBLISHABLE_KEY;
const email = process.env.PIE_TEST_USER_A_EMAIL;
const password = process.env.PIE_TEST_PASSWORD;
if (!url || !key || !email || !password) throw new Error("Missing P16 projection-prime environment");

const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error || !data.session) throw new Error("P16 projection-prime login failed: " + (error?.message ?? "no session"));

const response = await fetch(url + "/functions/v1/pie-p14-shadow-read", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + data.session.access_token,
    apikey: key,
    "Content-Type": "application/json",
  },
  body: "{}",
});
const payload = await response.json().catch(() => ({}));
await client.auth.signOut();

if (!response.ok || payload.status !== "ready") {
  throw new Error("P16 projection-prime failed: HTTP " + response.status + " " + JSON.stringify(payload));
}
console.log("PASS P16 projection precondition established; status=ready; source=" + String(payload.read_source));

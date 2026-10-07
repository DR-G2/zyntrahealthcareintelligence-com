import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normaliseEmail, isExactAdminRow, clampPage } from "./policy.ts";

/**
 * P5 (Hank B1): the ONLY data path for the /questions bank browser. The admin check is done
 * here, server-side: the caller's JWT is verified, the email is normalised to lower case and
 * matched EXACTLY (.eq, no LIKE wildcards) against admin_roles, and the returned row is
 * re-checked. Only then are questions (with keys/explanations) read with the service role.
 */
const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return reply({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: u, error: uErr } = await admin.auth.getUser(auth.slice(7));
    const email = normaliseEmail(u?.user?.email);
    if (uErr || !email) return reply({ error: "Unauthorized" }, 401);
    const { data: role } = await admin.from("admin_roles").select("role, email").eq("email", email).maybeSingle();
    if (!isExactAdminRow(role, email)) return reply({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { from, to } = clampPage(body?.offset, body?.limit);
    const { data, error } = await admin.from("questions").select("*").order("id").range(from, to);
    if (error) return reply({ error: error.message }, 500);
    return reply({ questions: data ?? [], offset: from, done: (data?.length ?? 0) < to - from + 1 });
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : "admin-question-bank failed" }, 500);
  }
});

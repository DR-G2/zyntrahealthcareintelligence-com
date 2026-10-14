import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normaliseEmail, canReadQuestionBank, clampPage } from "./policy.ts";
import { adminCorsHeaders, parseAllowedOrigins } from "../_shared/admin-gate.ts";
import { adminRoleRow } from "../_shared/admin-rpc.ts";

/**
 * P5 (Hank B1): the ONLY data path for the /questions bank browser. The admin check is done
 * here, server-side: the caller's JWT is verified, the email is trimmed + lower-cased and matched
 * EXACTLY (.eq, no LIKE wildcards) against is_admin() (pie.security_admin_allowlist via _shared/admin-rpc.ts; super_admin = is_super_admin()), the returned row's email is lower-cased and
 * re-checked, and the role must be super_admin (follow-up: no broader access is needed, see
 * policy.ts). Only then are questions (with keys/explanations) read with the service role.
 */
const allowedOrigins = parseAllowedOrigins(Deno.env.get("ADMIN_ALLOWED_ORIGINS") ?? Deno.env.get("ADMIN_ALLOWED_ORIGIN"));

serve(async (req) => {
  const headers = { ...adminCorsHeaders(req.headers.get("Origin"), allowedOrigins), "Content-Type": "application/json" };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return reply({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: u, error: uErr } = await admin.auth.getUser(auth.slice(7));
    const email = normaliseEmail(u?.user?.email);
    if (uErr || !email) return reply({ error: "Unauthorized" }, 401);
    const { data: role, error: adminGateErr } = await adminRoleRow(req, email);
    // P2: explicit fail-closed on ANY RPC error (42883/42P01/missing bearer/throw/...).
    if (adminGateErr) {
      console.error("[admin-question-bank] admin RPC check failed (denying):", adminGateErr);
      return reply({ error: "Forbidden - Super Admin only" }, 403);
    }
    if (!canReadQuestionBank(role, email)) return reply({ error: "Forbidden - Super Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const { from, to } = clampPage(body?.offset, body?.limit);
    const { data, error } = await admin.from("questions").select("*").order("id").range(from, to);
    if (error) return reply({ error: error.message }, 500);
    return reply({ questions: data ?? [], offset: from, done: (data?.length ?? 0) < to - from + 1 });
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : "admin-question-bank failed" }, 500);
  }
});

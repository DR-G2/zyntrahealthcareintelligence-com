import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PIE_V2_AUTH_HEADER, sameLearner, type PieHistoryRow } from "./pie-v2-history.ts";

/**
 * Reads the caller's PIE attempt history from V2 with the CALLER'S OWN V2 JWT (sent by the app
 * in x-pie-v2-authorization). No service role: get_my_attempt_history is auth.uid()-scoped on
 * V2 and returns answered attempts only. The V2 identity must match the V1 caller's email.
 * Env: PIE_V2_URL, PIE_V2_ANON_KEY.
 */
export async function fetchCallerPieHistory(req: Request, v1Email: string | null | undefined, limit = 1000):
  Promise<{ rows: PieHistoryRow[] } | { error: string; status: number }> {
  const header = req.headers.get(PIE_V2_AUTH_HEADER) ?? "";
  if (!header.startsWith("Bearer ")) return { error: "PIE session required (missing V2 authorization)", status: 401 };
  const url = Deno.env.get("PIE_V2_URL"); const anon = Deno.env.get("PIE_V2_ANON_KEY");
  if (!url || !anon) return { error: "PIE_V2_URL / PIE_V2_ANON_KEY not configured", status: 500 };
  const v2 = createClient(url, anon, { global: { headers: { Authorization: header } }, auth: { persistSession: false } });
  const { data: u, error: uErr } = await v2.auth.getUser(header.slice(7));
  if (uErr || !u?.user) return { error: "Invalid PIE session", status: 401 };
  if (!sameLearner(v1Email, u.user.email)) return { error: "PIE identity does not match the caller", status: 403 };
  const { data, error } = await v2.rpc("get_my_attempt_history", { p_limit: limit });
  if (error) return { error: error.message, status: 502 };
  return { rows: (data ?? []) as PieHistoryRow[] };
}

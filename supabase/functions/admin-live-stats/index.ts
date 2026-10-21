import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return reply({ error: "Server configuration unavailable" }, 500);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Unauthorized" }, 401);
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Unauthorized" }, 401);
    const { data: role, error: roleError } = await db.schema("command").from("admin_roles")
      .select("role").eq("user_id", auth.user.id).eq("active", true).maybeSingle();
    if (roleError) { console.error("admin role lookup failed", roleError); return reply({ error: "Admin authorization could not be verified" }, 500); }
    if (!role || !["admin", "super_admin", "super-admin"].includes(String(role.role).toLowerCase())) return reply({ error: "Forbidden" }, 403);

    const since = new Date(); since.setHours(0, 0, 0, 0);
    const [profilesRes, attemptsRes, stationsRes, progressRes] = await Promise.all([
      db.from("profiles").select("id,email,display_name,created_at").order("created_at", { ascending: false }).limit(1000),
      db.from("user_attempts").select("user_id,is_correct,created_at").order("created_at", { ascending: false }).limit(10000),
      db.from("station_attempts").select("user_id,created_at").order("created_at", { ascending: false }).limit(5000),
      db.from("user_progress").select("user_id,streak,last_activity_at").limit(5000),
    ]);
    for (const [name, result] of [["profiles", profilesRes], ["attempts", attemptsRes], ["stations", stationsRes], ["progress", progressRes]] as const) {
      if (result.error) { console.error("admin-live-stats query failed", name, result.error); return reply({ error: "Activity data query failed", source: name }, 500); }
    }
    const attemptMap = new Map<string, { total: number; correct: number; today: number }>();
    for (const a of attemptsRes.data ?? []) {
      const v = attemptMap.get(a.user_id) ?? { total: 0, correct: 0, today: 0 };
      v.total++; if (a.is_correct) v.correct++; if (new Date(a.created_at) >= since) v.today++;
      attemptMap.set(a.user_id, v);
    }
    const stationMap = new Map<string, { total: number; today: number }>();
    for (const a of stationsRes.data ?? []) {
      const v = stationMap.get(a.user_id) ?? { total: 0, today: 0 };
      v.total++; if (new Date(a.created_at) >= since) v.today++;
      stationMap.set(a.user_id, v);
    }
    const progressMap = new Map<string, { streak: number; last: string | null }>();
    for (const p of progressRes.data ?? []) {
      const prev = progressMap.get(p.user_id);
      const last = p.last_activity_at && (!prev?.last || p.last_activity_at > prev.last) ? p.last_activity_at : prev?.last ?? null;
      progressMap.set(p.user_id, { streak: Math.max(prev?.streak ?? 0, p.streak ?? 0), last });
    }
    const stats = (profilesRes.data ?? []).map(p => {
      const a = attemptMap.get(p.id) ?? { total: 0, correct: 0, today: 0 };
      const s = stationMap.get(p.id) ?? { total: 0, today: 0 };
      const prog = progressMap.get(p.id);
      return { user_id: p.id, email: p.email ?? "", name: p.display_name ?? "", joined_at: p.created_at,
        total_questions: a.total, total_correct: a.correct, overall_accuracy: a.total ? Math.round(a.correct / a.total * 100) : 0,
        total_osce: s.total, streak_days: prog?.streak ?? 0, last_active: prog?.last ?? null, ip_address: null,
        questions_today: a.today, osce_today: s.today };
    }).sort((a,b) => (b.last_active ?? "").localeCompare(a.last_active ?? ""));
    return reply({ stats, online_user_ids: [], presence_available: false, truncated: true });
  } catch (e) {
    console.error("admin-live-stats unexpected failure", e);
    return reply({ error: "Internal activity service error" }, 500);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await supabaseAdmin.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const [profilesRes, allAttemptsRes, todayAttemptsRes, allStationsRes, todayStationsRes, progressRes, presenceRes] = await Promise.all([
      supabase.from("profiles").select("id, email, name, created_at"),
      supabase.from("user_attempts").select("user_id, is_correct"),
      supabase.from("user_attempts").select("user_id, is_correct").gte("created_at", todayISO),
      supabase.from("station_attempts").select("user_id"),
      supabase.from("station_attempts").select("user_id").gte("created_at", todayISO),
      supabase.from("user_progress").select("user_id, streak_days"),
      supabase.from("user_presence").select("user_id, is_online, last_seen_at, ip_address"),
    ]);

    const profiles = profilesRes.data || [];

    const allAttemptMap: Record<string, { total: number; correct: number }> = {};
    (allAttemptsRes.data || []).forEach(a => {
      if (!allAttemptMap[a.user_id]) allAttemptMap[a.user_id] = { total: 0, correct: 0 };
      allAttemptMap[a.user_id].total++;
      if (a.is_correct) allAttemptMap[a.user_id].correct++;
    });

    const todayAttemptMap: Record<string, { total: number; correct: number }> = {};
    (todayAttemptsRes.data || []).forEach(a => {
      if (!todayAttemptMap[a.user_id]) todayAttemptMap[a.user_id] = { total: 0, correct: 0 };
      todayAttemptMap[a.user_id].total++;
      if (a.is_correct) todayAttemptMap[a.user_id].correct++;
    });

    const allStationMap: Record<string, number> = {};
    (allStationsRes.data || []).forEach(s => {
      allStationMap[s.user_id] = (allStationMap[s.user_id] || 0) + 1;
    });

    const todayStationMap: Record<string, number> = {};
    (todayStationsRes.data || []).forEach(s => {
      todayStationMap[s.user_id] = (todayStationMap[s.user_id] || 0) + 1;
    });

    const progressMap: Record<string, { streak_days: number }> = {};
    (progressRes.data || []).forEach(p => {
      progressMap[p.user_id] = { streak_days: p.streak_days };
    });

    const presenceMap: Record<string, { last_seen_at: string | null; ip_address: string | null; is_online: boolean }> = {};
    (presenceRes.data || []).forEach(p => {
      presenceMap[p.user_id] = { last_seen_at: p.last_seen_at, ip_address: p.ip_address, is_online: p.is_online ?? false };
    });

    const online_user_ids: string[] = [];

    const stats = profiles.map(prof => {
      const uid = prof.id;
      const allAtt = allAttemptMap[uid] || { total: 0, correct: 0 };
      const todayAtt = todayAttemptMap[uid] || { total: 0, correct: 0 };
      const prog = progressMap[uid];
      const presence = presenceMap[uid];

      if (presence?.is_online) online_user_ids.push(uid);

      return {
        user_id: uid,
        email: prof.email || "",
        name: prof.name || "",
        joined_at: prof.created_at,
        total_questions: allAtt.total,
        total_correct: allAtt.correct,
        overall_accuracy: allAtt.total > 0 ? Math.round((allAtt.correct / allAtt.total) * 100) : 0,
        total_osce: allStationMap[uid] || 0,
        streak_days: prog?.streak_days || 0,
        last_active: presence?.last_seen_at || null,
        ip_address: presence?.ip_address || null,
        questions_today: todayAtt.total,
        osce_today: todayStationMap[uid] || 0,
      };
    });

    stats.sort((a, b) => {
      if (a.last_active && b.last_active) return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
      if (a.last_active) return -1;
      if (b.last_active) return 1;
      return 0;
    });

    return new Response(JSON.stringify({ stats, online_user_ids }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("admin-live-stats error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

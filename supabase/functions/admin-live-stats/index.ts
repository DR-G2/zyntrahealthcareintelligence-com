import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "gopalrock.naren@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin using getClaims (doesn't require active session)
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims || claimsData.claims.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { user_ids } = await req.json();

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ stats: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    // Fetch profiles, today's attempts, today's stations, and progress in parallel
    const [profilesRes, attemptsRes, stationsRes, progressRes] = await Promise.all([
      supabase.from("profiles").select("id, email, name").in("id", user_ids),
      supabase.from("user_attempts").select("user_id, is_correct").in("user_id", user_ids).gte("created_at", todayISO),
      supabase.from("station_attempts").select("user_id").in("user_id", user_ids).gte("created_at", todayISO),
      supabase.from("user_progress").select("user_id, streak_days").in("user_id", user_ids),
    ]);

    const profiles = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]));

    // Aggregate per user
    const attemptMap: Record<string, { total: number; correct: number }> = {};
    (attemptsRes.data || []).forEach(a => {
      if (!attemptMap[a.user_id]) attemptMap[a.user_id] = { total: 0, correct: 0 };
      attemptMap[a.user_id].total++;
      if (a.is_correct) attemptMap[a.user_id].correct++;
    });

    const stationMap: Record<string, number> = {};
    (stationsRes.data || []).forEach(s => {
      stationMap[s.user_id] = (stationMap[s.user_id] || 0) + 1;
    });

    const streakMap: Record<string, number> = {};
    (progressRes.data || []).forEach(p => {
      streakMap[p.user_id] = p.streak_days;
    });

    const stats = user_ids.map(uid => {
      const prof = profiles[uid] || {};
      const att = attemptMap[uid] || { total: 0, correct: 0 };
      return {
        user_id: uid,
        email: prof.email || "",
        name: prof.name || "",
        questions_today: att.total,
        accuracy_today: att.total > 0 ? Math.round((att.correct / att.total) * 100) : 0,
        streak_days: streakMap[uid] || 0,
        osce_today: stationMap[uid] || 0,
      };
    });

    return new Response(JSON.stringify({ stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("admin-live-stats error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await admin.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [profileRes, presenceRes, attemptsRes, behaviorRes, performanceRes, progressRes, osceRes, todayAttemptsRes, overrideRes, paymentsRes] = await Promise.all([
      admin.from("profiles").select("*").eq("id", user_id).maybeSingle(),
      admin.from("user_presence").select("*").eq("user_id", user_id).maybeSingle(),
      admin.from("user_attempts").select("id, question_id, selected_answer, is_correct, answer_changes_count, time_taken_seconds, created_at, questions(question_text, correct_answer, category)").eq("user_id", user_id).order("created_at", { ascending: false }).limit(50),
      admin.from("behavior_profiles").select("*").eq("user_id", user_id).maybeSingle(),
      admin.from("performance_profiles").select("*").eq("user_id", user_id).maybeSingle(),
      admin.from("user_progress").select("*").eq("user_id", user_id).maybeSingle(),
      admin.from("station_attempts").select("id", { count: "exact", head: true }).eq("user_id", user_id),
      admin.from("user_attempts").select("id", { count: "exact", head: true }).eq("user_id", user_id).gte("created_at", new Date().toISOString().split("T")[0]),
      admin.from("manual_overrides").select("*").eq("user_id", user_id).maybeSingle(),
      admin.from("payments").select("*").eq("user_id", user_id).eq("status", "active").order("created_at", { ascending: false }).limit(1),
    ]);

    const attempts = attemptsRes.data || [];
    const { count: realCount } = await admin.from("user_attempts").select("id", { count: "exact", head: true }).eq("user_id", user_id);

    const subjectBreakdown: Record<string, { correct: number; total: number }> = {};
    for (const a of attempts) {
      const cat = (a as any).questions?.category || "Unknown";
      if (!subjectBreakdown[cat]) subjectBreakdown[cat] = { correct: 0, total: 0 };
      subjectBreakdown[cat].total++;
      if (a.is_correct) subjectBreakdown[cat].correct++;
    }

    const totalCorrect = attempts.filter(a => a.is_correct).length;
    const totalChanges = attempts.reduce((s, a) => s + (a.answer_changes_count || 0), 0);
    const avgTime = attempts.length > 0 ? attempts.reduce((s, a) => s + a.time_taken_seconds, 0) / attempts.length : 0;

    // Build subscription info
    let subscription: any = { status: "free", tier: "free", subscription_end: null, days_remaining: null };

    const override = overrideRes.data;
    if (override) {
      const isExpired = override.expires_at && new Date(override.expires_at) < new Date();
      if (!isExpired) {
        subscription = {
          status: "active",
          tier: override.tier,
          subscription_end: override.expires_at,
          days_remaining: override.expires_at
            ? Math.max(0, Math.ceil((new Date(override.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null,
          source: "manual_override",
          granted_by: override.granted_by,
        };
      }
    }

    if (subscription.status === "free") {
      const payments = paymentsRes.data || [];
      if (payments.length > 0) {
        const p = payments[0];
        subscription = {
          status: "active",
          tier: p.tier,
          subscription_end: null,
          days_remaining: null,
          source: "payment",
          razorpay_subscription_id: p.razorpay_subscription_id,
        };
      }
    }

    return new Response(JSON.stringify({
      profile: profileRes.data,
      presence: presenceRes.data,
      behavior: behaviorRes.data,
      performance: performanceRes.data,
      subscription,
      stats: {
        total_attempts: realCount || 0,
        today_attempts: todayAttemptsRes.count || 0,
        accuracy: (realCount || 0) > 0 ? (totalCorrect / Math.min(attempts.length, realCount || 1)) * 100 : 0,
        avg_time: avgTime,
        total_changes: totalChanges,
        total_osce: osceRes.count || 0,
        streak_days: progressRes.data?.streak_days || 0,
        subject_breakdown: subjectBreakdown,
      },
      recent_attempts: attempts.map(a => ({
        id: a.id,
        question_text: (a as any).questions?.question_text,
        correct_answer: (a as any).questions?.correct_answer,
        category: (a as any).questions?.category,
        selected_answer: a.selected_answer,
        is_correct: a.is_correct,
        answer_changes_count: a.answer_changes_count,
        time_taken_seconds: a.time_taken_seconds,
        created_at: a.created_at,
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function assignTier(avgTime: number, changeRate: number, correctRate: number): number {
  // Tier 1 "Gimme": <60s, <10% changes, >85% correct
  if (avgTime < 60 && changeRate < 0.1 && correctRate > 0.85) return 1;
  // Tier 5 "System Destroyer": <25% correct
  if (correctRate < 0.25) return 5;
  // Tier 4 "Killer": >180s or bimodal, >40% changes, <40% correct
  if ((avgTime > 180 || changeRate > 0.4) && correctRate < 0.4) return 4;
  // Tier 3 "Trapper": 120-180s, 25-40% changes, 40-60% correct
  if (avgTime > 120 && changeRate > 0.25 && correctRate < 0.6) return 3;
  // Tier 2 "Thinker": 60-120s, 10-25% changes, 60-85% correct
  if (avgTime >= 60 && correctRate >= 0.6) return 2;
  // Default to tier 3
  return 3;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace("Bearer ", "");
    const _supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await _supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all attempts grouped by question
    const { data: attempts, error } = await supabase
      .from("user_attempts")
      .select("question_id, time_taken_seconds, answer_changes_count, is_correct")
      .limit(10000);

    if (error) throw error;
    if (!attempts || attempts.length === 0) {
      return new Response(JSON.stringify({ message: "No attempts data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by question_id
    const grouped: Record<string, { times: number[]; changes: number[]; correct: number; total: number }> = {};
    attempts.forEach(a => {
      if (!grouped[a.question_id]) grouped[a.question_id] = { times: [], changes: [], correct: 0, total: 0 };
      grouped[a.question_id].times.push(a.time_taken_seconds || 0);
      grouped[a.question_id].changes.push(a.answer_changes_count || 0);
      grouped[a.question_id].total++;
      if (a.is_correct) grouped[a.question_id].correct++;
    });

    let updated = 0;
    for (const [questionId, stats] of Object.entries(grouped)) {
      if (stats.total < 3) continue; // Need minimum sample

      const avgTime = stats.times.reduce((a, b) => a + b, 0) / stats.total;
      const changeRate = stats.changes.filter(c => c > 0).length / stats.total;
      const correctRate = stats.correct / stats.total;
      const tier = assignTier(avgTime, changeRate, correctRate);

      // Upsert question_difficulty_tiers
      const { error: upsertErr } = await supabase
        .from("question_difficulty_tiers")
        .upsert({
          question_id: questionId,
          tier,
          avg_time_seconds: Math.round(avgTime * 10) / 10,
          change_rate: Math.round(changeRate * 100) / 100,
          correct_rate: Math.round(correctRate * 100) / 100,
          sample_size: stats.total,
          updated_at: new Date().toISOString(),
        }, { onConflict: "question_id" });

      if (upsertErr) console.error("Upsert error for", questionId, upsertErr);

      // Update questions table difficulty_tier
      await supabase
        .from("questions")
        .update({ difficulty_tier: tier })
        .eq("id", questionId);

      updated++;
    }

    return new Response(JSON.stringify({ message: `Updated ${updated} question tiers` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compute-question-tiers error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

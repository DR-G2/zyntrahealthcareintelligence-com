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
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Aggregate MCQ attempts
    const { data: attempts, error: attErr } = await supabase
      .from("user_attempts")
      .select("user_id, is_correct, answer_changes_count, time_taken_seconds, questions(category, difficulty)")
      .limit(10000);
    if (attErr) throw attErr;

    const totalAttempts = attempts?.length || 0;
    const correctCount = attempts?.filter(a => a.is_correct).length || 0;
    const overallAccuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
    const avgTime = totalAttempts > 0 ? Math.round(attempts!.reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / totalAttempts) : 0;
    const avgChanges = totalAttempts > 0 ? Math.round((attempts!.reduce((s, a) => s + (a.answer_changes_count || 0), 0) / totalAttempts) * 100) / 100 : 0;

    // Per-category stats
    const catMap: Record<string, { correct: number; total: number }> = {};
    attempts?.forEach(a => {
      const cat = (a.questions as any)?.category || "Unknown";
      if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 };
      catMap[cat].total++;
      if (a.is_correct) catMap[cat].correct++;
    });
    const categoryPassRates = Object.entries(catMap).map(([cat, s]) => ({
      category: cat,
      accuracy: Math.round((s.correct / s.total) * 100),
      sample: s.total,
    })).sort((a, b) => a.accuracy - b.accuracy);

    // 2. Aggregate behavior profiles
    const { data: profiles } = await supabase.from("behavior_profiles").select("archetype, trap_flags").limit(5000);
    const archetypeDist: Record<string, number> = {};
    const trapCounts: Record<string, number> = {};
    profiles?.forEach(p => {
      archetypeDist[p.archetype] = (archetypeDist[p.archetype] || 0) + 1;
      if (Array.isArray(p.trap_flags)) {
        (p.trap_flags as any[]).forEach((t: any) => {
          const name = typeof t === 'string' ? t : t?.trap;
          if (name) trapCounts[name] = (trapCounts[name] || 0) + 1;
        });
      }
    });

    // 3. Aggregate OSCE station attempts
    const { data: stationAttempts } = await supabase
      .from("station_attempts")
      .select("scores, subject")
      .limit(5000);
    const osceCount = stationAttempts?.length || 0;
    let osceScoreSum = 0;
    const osceSubMap: Record<string, { total: number; scoreSum: number }> = {};
    stationAttempts?.forEach(sa => {
      const score = (sa.scores as any)?.overall || 0;
      osceScoreSum += score;
      const subj = sa.subject || "Unknown";
      if (!osceSubMap[subj]) osceSubMap[subj] = { total: 0, scoreSum: 0 };
      osceSubMap[subj].total++;
      osceSubMap[subj].scoreSum += score;
    });

    // 4. First-instinct stats
    const changedAttempts = attempts?.filter(a => a.answer_changes_count > 0) || [];
    const changeRate = totalAttempts > 0 ? Math.round((changedAttempts.length / totalAttempts) * 100) : 0;

    // 5. Unique candidates
    const uniqueUsers = new Set(attempts?.map(a => a.user_id) || []);
    const candidateCount = uniqueUsers.size;

    const aggregateData = {
      mcq: {
        total_attempts: totalAttempts,
        overall_accuracy: overallAccuracy,
        avg_time_seconds: avgTime,
        avg_answer_changes: avgChanges,
        change_rate_percent: changeRate,
        category_pass_rates: categoryPassRates,
      },
      behavior: {
        archetype_distribution: archetypeDist,
        common_traps: Object.entries(trapCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([trap, count]) => ({ trap, count, percent: Math.round((count / (profiles?.length || 1)) * 100) })),
      },
      osce: {
        total_stations: osceCount,
        avg_score: osceCount > 0 ? Math.round(osceScoreSum / osceCount) : 0,
        subject_stats: Object.entries(osceSubMap).map(([subj, s]) => ({
          subject: subj,
          avg_score: Math.round(s.scoreSum / s.total),
          count: s.total,
        })),
      },
      generated_at: new Date().toISOString(),
    };

    // Upsert single row
    const { data: existing } = await supabase.from("ai_training_context").select("id").limit(1).maybeSingle();
    if (existing) {
      await supabase.from("ai_training_context").update({
        aggregate_data: aggregateData,
        candidate_count: candidateCount,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("ai_training_context").insert({
        aggregate_data: aggregateData,
        candidate_count: candidateCount,
      });
    }

    return new Response(JSON.stringify({ success: true, candidate_count: candidateCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("retrain-ai-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

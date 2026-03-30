import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Admin-only check
    const ADMIN_EMAILS = ["gopalrock.naren@gmail.com", "amc.osce.2026@gmail.com", "testuser123@zyntr.website"];
    const callerEmail = userData.user.email ?? "";
    if (!ADMIN_EMAILS.includes(callerEmail)) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    // Allow admin to export for a specific user
    const targetUserId = body.target_user_id || userData.user.id;
    const userId = targetUserId;

    const format = body.format || "json";
    const range = body.range || "full";
    const startDate = body.start_date || null;
    const endDate = body.end_date || null;

    // Build date filter
    let dateFilter: { from?: string; to?: string } | null = null;
    const now = new Date();
    if (range === "7d") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { from: weekAgo.toISOString(), to: now.toISOString() };
    } else if (range === "custom" && startDate && endDate) {
      dateFilter = { from: new Date(startDate).toISOString(), to: new Date(endDate).toISOString() };
    }

    // 1. Readiness DNA
    const { data: readiness } = await supabase
      .from("readiness_dna")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 2. Behavior profile
    const { data: behavior } = await supabase
      .from("behavior_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 3. Subject DNA
    const { data: subjectDna } = await supabase
      .from("subject_dna")
      .select("*")
      .eq("user_id", userId);

    // 4. Performance profile
    const { data: performance } = await supabase
      .from("performance_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 5. Question history (with date filter)
    let attemptsQuery = supabase
      .from("user_attempts")
      .select("id, question_id, is_correct, selected_answer, time_taken_seconds, answer_changes_count, change_sequence, question_position, time_to_first_click, created_at, questions(category, difficulty, subtopic, question_type)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (dateFilter) {
      attemptsQuery = attemptsQuery.gte("created_at", dateFilter.from!).lte("created_at", dateFilter.to!);
    }
    const { data: attempts } = await attemptsQuery;

    // 6. Psychograph history
    let psychQuery = supabase
      .from("psychograph_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (dateFilter) {
      psychQuery = psychQuery.gte("created_at", dateFilter.from!).lte("created_at", dateFilter.to!);
    }
    const { data: psychographs } = await psychQuery;

    // 7. Station attempts
    let stationQuery = supabase
      .from("station_attempts")
      .select("id, session_id, subject, scores, behavioral_signals, psychograph, time_taken_seconds, mode, station_index, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (dateFilter) {
      stationQuery = stationQuery.gte("created_at", dateFilter.from!).lte("created_at", dateFilter.to!);
    }
    const { data: stationAttempts } = await stationQuery;

    // Compute AI growth score
    const totalAttempts = readiness?.attempt_count ?? 0;
    const aiGrowthScore = Math.min(98, Math.round(20 * Math.log10(Math.max(totalAttempts, 1)) + 10));

    // Build mistake patterns
    const incorrectAttempts = (attempts || []).filter(a => !a.is_correct);
    const categoryMistakes: Record<string, number> = {};
    incorrectAttempts.forEach(a => {
      const cat = (a.questions as any)?.category || "Unknown";
      categoryMistakes[cat] = (categoryMistakes[cat] || 0) + 1;
    });
    const mistakePatterns = Object.entries(categoryMistakes)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => ({ category, count, percent: totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0 }));

    // Build performance trends (daily aggregation)
    const dailyMap: Record<string, { correct: number; total: number; time: number }> = {};
    (attempts || []).forEach(a => {
      const day = a.created_at.substring(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { correct: 0, total: 0, time: 0 };
      dailyMap[day].total++;
      if (a.is_correct) dailyMap[day].correct++;
      dailyMap[day].time += a.time_taken_seconds || 0;
    });
    const performanceTrends = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, s]) => ({
        date,
        accuracy: Math.round((s.correct / s.total) * 100),
        total_questions: s.total,
        avg_time_seconds: Math.round(s.time / s.total),
      }));

    // Clean nulls helper
    const clean = (obj: any) => {
      if (obj === null || obj === undefined) return {};
      const cleaned: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === "id" || k === "user_id") continue;
        cleaned[k] = v ?? null;
      }
      return cleaned;
    };

    const exportData = {
      schema_version: "1.0",
      user_id: userId,
      ai_growth_score: aiGrowthScore,
      accuracy_metrics: {
        clinical_accuracy: readiness?.clinical_accuracy ?? 0,
        answer_stability: readiness?.answer_stability ?? 0,
        confidence_calibration: readiness?.confidence_calibration ?? 0,
        readiness_score: readiness?.readiness_score ?? 0,
        total_attempts: totalAttempts,
      },
      behavioral_patterns: {
        archetype: behavior?.archetype ?? "unclassified",
        rush_index: behavior?.rush_index ?? 0,
        hesitation_index: behavior?.hesitation_index ?? 0,
        fatigue_index: behavior?.fatigue_index ?? 0,
        archetype_signals: behavior?.archetype_signals ?? {},
        trap_flags: behavior?.trap_flags ?? [],
        predicted_score: {
          low: behavior?.predicted_score_low ?? null,
          high: behavior?.predicted_score_high ?? null,
          potential: behavior?.predicted_score_potential ?? null,
        },
      },
      timing_patterns: {
        avg_time_seconds: readiness?.time_management ?? 0,
        time_sensitivity: performance?.time_sensitivity ?? 0,
      },
      difficulty_mapping: (subjectDna || []).map(s => ({
        subject: s.subject,
        accuracy: s.accuracy ?? 0,
        attempt_count: s.attempt_count ?? 0,
        avg_time: s.avg_time ?? 0,
        stability: s.stability ?? 0,
        gap_score: s.gap_score ?? 0,
      })),
      clinical_reasoning_nodes: {
        performance_profile: clean(performance),
        psychograph_snapshots: (psychographs || []).slice(0, 50).map(p => ({
          session_id: p.session_id,
          archetype: p.archetype,
          structure_integrity: p.structure_integrity,
          delegation_confidence: p.delegation_confidence,
          silence_tolerance: p.silence_tolerance,
          time_compression_vulnerability: p.time_compression_vulnerability,
          emotional_reactivity: p.emotional_reactivity,
          cognitive_stability: p.cognitive_stability,
          created_at: p.created_at,
        })),
      },
      rule_out_patterns: {
        change_rate: totalAttempts > 0
          ? Math.round(((attempts || []).filter(a => a.answer_changes_count > 0).length / totalAttempts) * 100)
          : 0,
        avg_changes_per_question: totalAttempts > 0
          ? Math.round(((attempts || []).reduce((s, a) => s + a.answer_changes_count, 0) / totalAttempts) * 100) / 100
          : 0,
      },
      question_history: (attempts || []).map(a => ({
        question_id: a.question_id,
        is_correct: a.is_correct,
        selected_answer: a.selected_answer,
        time_taken_seconds: a.time_taken_seconds,
        answer_changes_count: a.answer_changes_count,
        change_sequence: a.change_sequence,
        question_position: a.question_position,
        time_to_first_click: a.time_to_first_click,
        category: (a.questions as any)?.category || null,
        difficulty: (a.questions as any)?.difficulty || null,
        subtopic: (a.questions as any)?.subtopic || null,
        created_at: a.created_at,
      })),
      osce_history: (stationAttempts || []).map(sa => ({
        session_id: sa.session_id,
        subject: sa.subject,
        scores: sa.scores,
        behavioral_signals: sa.behavioral_signals,
        psychograph: sa.psychograph,
        time_taken_seconds: sa.time_taken_seconds,
        mode: sa.mode,
        station_index: sa.station_index,
        created_at: sa.created_at,
      })),
      mistake_patterns: mistakePatterns,
      performance_trends: performanceTrends,
      export_metadata: {
        exported_at: now.toISOString(),
        range,
        date_filter: dateFilter,
        platform: "zyntra",
      },
    };

    // Log export
    const { data: lastVersion } = await supabase
      .from("data_export_history")
      .select("version")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (lastVersion?.version ?? 0) + 1;
    const fileName = `zyntra_ai_core_${userId.substring(0, 8)}_${now.toISOString().replace(/[:.]/g, "-")}.${format}`;

    await supabase.from("data_export_history").insert({
      user_id: userId,
      action_type: "export",
      file_name: fileName,
      version: nextVersion,
      snapshot_data: { range, format, record_counts: { attempts: (attempts || []).length, stations: (stationAttempts || []).length } },
    });

    if (format === "csv") {
      // Flatten question_history to CSV
      const headers = ["question_id", "is_correct", "selected_answer", "time_taken_seconds", "answer_changes_count", "category", "difficulty", "subtopic", "created_at"];
      const rows = exportData.question_history.map(q =>
        headers.map(h => {
          const val = (q as any)[h];
          return val === null || val === undefined ? "" : `"${String(val).replace(/"/g, '""')}"`;
        }).join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("export-learning-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

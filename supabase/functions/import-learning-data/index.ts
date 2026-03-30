import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUIRED_FIELDS = ["schema_version", "accuracy_metrics", "behavioral_patterns", "question_history"];

function validateSchema(data: any): string[] {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    errors.push("Root must be a JSON object");
    return errors;
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) errors.push(`Missing required field: "${field}"`);
  }
  if (data.schema_version && data.schema_version !== "1.0") {
    errors.push(`Unsupported schema version: "${data.schema_version}". Expected "1.0"`);
  }
  if (data.accuracy_metrics && typeof data.accuracy_metrics !== "object") {
    errors.push("accuracy_metrics must be an object");
  }
  if (data.behavioral_patterns && typeof data.behavioral_patterns !== "object") {
    errors.push("behavioral_patterns must be an object");
  }
  if (data.question_history && !Array.isArray(data.question_history)) {
    errors.push("question_history must be an array");
  }
  if (data.difficulty_mapping && !Array.isArray(data.difficulty_mapping)) {
    errors.push("difficulty_mapping must be an array");
  }
  return errors;
}

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

    const body = await req.json();
    const { data: importData, merge_mode = "merge", simulate = false, target_user_id } = body;
    const userId = target_user_id || userData.user.id;

    const body = await req.json();
    const { data: importData, merge_mode = "merge", simulate = false } = body;

    if (!importData) {
      return new Response(JSON.stringify({ error: "Missing 'data' field" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ownership validation - reject if user_id in data doesn't match
    if (importData.user_id && importData.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Data ownership mismatch. This dataset belongs to a different user." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Schema validation
    const validationErrors = validateSchema(importData);
    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({ error: "Schema validation failed", details: validationErrors }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simulation mode — just validate and return preview
    if (simulate) {
      const preview = {
        valid: true,
        merge_mode,
        records_to_process: {
          accuracy_metrics: importData.accuracy_metrics ? 1 : 0,
          behavioral_patterns: importData.behavioral_patterns ? 1 : 0,
          difficulty_mapping: (importData.difficulty_mapping || []).length,
          question_history: (importData.question_history || []).length,
          osce_history: (importData.osce_history || []).length,
          performance_trends: (importData.performance_trends || []).length,
        },
        warnings: [] as string[],
      };
      if (merge_mode === "replace") {
        preview.warnings.push("Replace mode will overwrite all existing learning data");
      }
      return new Response(JSON.stringify(preview), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Snapshot current state before import for rollback
    const [
      { data: currentReadiness },
      { data: currentBehavior },
      { data: currentSubjectDna },
      { data: currentPerformance },
    ] = await Promise.all([
      supabase.from("readiness_dna").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("behavior_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("subject_dna").select("*").eq("user_id", userId),
      supabase.from("performance_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const snapshot = { readiness: currentReadiness, behavior: currentBehavior, subjectDna: currentSubjectDna, performance: currentPerformance };

    const results: Record<string, string> = {};

    // === IMPORT READINESS DNA ===
    if (importData.accuracy_metrics) {
      const am = importData.accuracy_metrics;
      if (merge_mode === "replace") {
        await supabase.from("readiness_dna").upsert({
          user_id: userId,
          clinical_accuracy: am.clinical_accuracy ?? 0,
          answer_stability: am.answer_stability ?? 0,
          confidence_calibration: am.confidence_calibration ?? 0,
          readiness_score: am.readiness_score ?? 0,
          time_management: importData.timing_patterns?.avg_time_seconds ?? 0,
          attempt_count: am.total_attempts ?? 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        results.readiness_dna = "replaced";
      } else {
        // Merge: weighted average based on attempt counts
        const existing = currentReadiness;
        const existCount = existing?.attempt_count ?? 0;
        const importCount = am.total_attempts ?? 0;
        const totalCount = existCount + importCount;
        if (totalCount > 0) {
          const merge = (a: number, b: number) => Math.round(((a * existCount) + (b * importCount)) / totalCount * 100) / 100;
          await supabase.from("readiness_dna").upsert({
            user_id: userId,
            clinical_accuracy: merge(existing?.clinical_accuracy ?? 0, am.clinical_accuracy ?? 0),
            answer_stability: merge(existing?.answer_stability ?? 0, am.answer_stability ?? 0),
            confidence_calibration: merge(existing?.confidence_calibration ?? 0, am.confidence_calibration ?? 0),
            readiness_score: merge(existing?.readiness_score ?? 0, am.readiness_score ?? 0),
            time_management: merge(existing?.time_management ?? 0, importData.timing_patterns?.avg_time_seconds ?? 0),
            attempt_count: totalCount,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        }
        results.readiness_dna = "merged";
      }
    }

    // === IMPORT BEHAVIOR PROFILE ===
    if (importData.behavioral_patterns) {
      const bp = importData.behavioral_patterns;
      const behaviorData: any = {
        user_id: userId,
        archetype: bp.archetype ?? "strategist",
        rush_index: bp.rush_index ?? 0,
        hesitation_index: bp.hesitation_index ?? 0,
        fatigue_index: bp.fatigue_index ?? 0,
        archetype_signals: bp.archetype_signals ?? {},
        trap_flags: bp.trap_flags ?? [],
        predicted_score_low: bp.predicted_score?.low ?? null,
        predicted_score_high: bp.predicted_score?.high ?? null,
        predicted_score_potential: bp.predicted_score?.potential ?? null,
        updated_at: new Date().toISOString(),
      };

      if (merge_mode === "replace" || !currentBehavior) {
        await supabase.from("behavior_profiles").upsert(behaviorData, { onConflict: "user_id" });
        results.behavior_profiles = merge_mode === "replace" ? "replaced" : "created";
      } else {
        // Merge: average indices
        const avg = (a: number, b: number) => Math.round(((a + b) / 2) * 100) / 100;
        await supabase.from("behavior_profiles").update({
          rush_index: avg(currentBehavior.rush_index ?? 0, bp.rush_index ?? 0),
          hesitation_index: avg(currentBehavior.hesitation_index ?? 0, bp.hesitation_index ?? 0),
          fatigue_index: avg(currentBehavior.fatigue_index ?? 0, bp.fatigue_index ?? 0),
          trap_flags: [...new Set([...(currentBehavior.trap_flags as any[] || []), ...(bp.trap_flags || [])])],
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        results.behavior_profiles = "merged";
      }
    }

    // === IMPORT SUBJECT DNA ===
    if (Array.isArray(importData.difficulty_mapping)) {
      for (const subj of importData.difficulty_mapping) {
        if (!subj.subject) continue;
        const subjectData = {
          user_id: userId,
          subject: subj.subject,
          accuracy: subj.accuracy ?? 0,
          attempt_count: subj.attempt_count ?? 0,
          avg_time: subj.avg_time ?? 0,
          stability: subj.stability ?? 0,
          gap_score: subj.gap_score ?? 0,
          updated_at: new Date().toISOString(),
        };

        if (merge_mode === "replace") {
          await supabase.from("subject_dna").upsert(subjectData, { onConflict: "user_id,subject" });
        } else {
          const existing = (currentSubjectDna || []).find(s => s.subject === subj.subject);
          if (existing) {
            const totalCount = (existing.attempt_count ?? 0) + (subj.attempt_count ?? 0);
            const merge = (a: number, b: number, ec: number, ic: number) => totalCount > 0 ? Math.round(((a * ec) + (b * ic)) / totalCount * 100) / 100 : 0;
            const ec = existing.attempt_count ?? 0;
            const ic = subj.attempt_count ?? 0;
            await supabase.from("subject_dna").update({
              accuracy: merge(existing.accuracy ?? 0, subj.accuracy ?? 0, ec, ic),
              attempt_count: totalCount,
              avg_time: merge(existing.avg_time ?? 0, subj.avg_time ?? 0, ec, ic),
              stability: merge(existing.stability ?? 0, subj.stability ?? 0, ec, ic),
              gap_score: merge(existing.gap_score ?? 0, subj.gap_score ?? 0, ec, ic),
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId).eq("subject", subj.subject);
          } else {
            await supabase.from("subject_dna").insert(subjectData);
          }
        }
      }
      results.subject_dna = `${importData.difficulty_mapping.length} subjects ${merge_mode === "replace" ? "replaced" : "merged"}`;
    }

    // === IMPORT PERFORMANCE PROFILE ===
    if (importData.clinical_reasoning_nodes?.performance_profile) {
      const pp = importData.clinical_reasoning_nodes.performance_profile;
      await supabase.from("performance_profiles").upsert({
        user_id: userId,
        clinical_accuracy: pp.clinical_accuracy ?? 0,
        stability_score: pp.stability_score ?? 0,
        time_sensitivity: pp.time_sensitivity ?? 0,
        confidence_gap: pp.confidence_gap ?? 0,
        readiness_score: pp.readiness_score ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      results.performance_profiles = merge_mode === "replace" ? "replaced" : "updated";
    }

    // Log import with snapshot for rollback
    const { data: lastVersion } = await supabase
      .from("data_export_history")
      .select("version")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    await supabase.from("data_export_history").insert({
      user_id: userId,
      action_type: "import",
      merge_mode,
      version: nextVersion,
      snapshot_data: snapshot,
      file_name: `import_v${nextVersion}`,
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Your learning model has been updated based on uploaded data.",
      version: nextVersion,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-learning-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

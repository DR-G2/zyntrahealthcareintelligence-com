import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const h = { ...corsHeaders, "Content-Type": "application/json" };

function fail(msg: string, status = 400, step?: string, details?: string[]) {
  return new Response(JSON.stringify({ success: false, error: msg, step: step ?? null, details: details ?? null }), { status, headers: h });
}

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let step = "init";
  try {
    // ── Step 1: Auth ──
    step = "auth";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return fail("Unauthorized", 401, step);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return fail("Unauthorized", 401, step);

    const callerEmail = (claims.claims.email as string) ?? "";
    const callerId = claims.claims.sub as string;

    // ── Step 2: Admin role check ──
    step = "admin_check";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: roleRow, error: roleErr } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("email", callerEmail)
      .maybeSingle();

    if (roleErr) {
      console.error("[import] admin_roles query error:", roleErr.message);
      return fail("Failed to verify admin role", 500, step);
    }
    if (!roleRow) return fail("Admin access required", 403, step);

    console.log(`[import] Admin verified: ${callerEmail} (${roleRow.role})`);

    // ── Step 3: Parse body ──
    step = "parse_body";
    let body: any;
    try { body = await req.json(); } catch { return fail("Invalid JSON body", 400, step); }

    const { data: importData, merge_mode, simulate, target_user_id } = body;
    if (!importData) return fail("Missing 'data' field", 400, step);

    const mode = merge_mode === "replace" ? "replace" : "merge";
    const sim = simulate === true;

    // ── Step 4: Validate target user ──
    step = "validate_target";
    const userId = target_user_id || callerId;
    if (target_user_id && !isUUID(target_user_id)) {
      return fail("Invalid target_user_id – must be a UUID", 422, step);
    }

    // ── Step 5: Schema validation ──
    step = "validate_schema";
    const errors: string[] = [];
    if (typeof importData !== "object" || importData === null) {
      return fail("Root data must be a JSON object", 422, step);
    }
    if (!("schema_version" in importData)) errors.push('Missing "schema_version"');
    if (!("accuracy_metrics" in importData)) errors.push('Missing "accuracy_metrics"');
    if (!("behavioral_patterns" in importData)) errors.push('Missing "behavioral_patterns"');
    if (!("question_history" in importData)) errors.push('Missing "question_history"');
    if (importData.schema_version && importData.schema_version !== "1.0") {
      errors.push(`Unsupported schema_version "${importData.schema_version}"`);
    }
    if (importData.accuracy_metrics && typeof importData.accuracy_metrics !== "object") errors.push("accuracy_metrics must be an object");
    if (importData.behavioral_patterns && typeof importData.behavioral_patterns !== "object") errors.push("behavioral_patterns must be an object");
    if (importData.question_history && !Array.isArray(importData.question_history)) errors.push("question_history must be an array");
    if (importData.difficulty_mapping && !Array.isArray(importData.difficulty_mapping)) errors.push("difficulty_mapping must be an array");
    if (errors.length > 0) return fail("Schema validation failed", 422, step, errors);

    // ── Step 6: Simulate ──
    if (sim) {
      step = "simulate";
      const preview = {
        success: true,
        valid: true,
        merge_mode: mode,
        records_to_process: {
          accuracy_metrics: importData.accuracy_metrics ? 1 : 0,
          behavioral_patterns: importData.behavioral_patterns ? 1 : 0,
          difficulty_mapping: (importData.difficulty_mapping || []).length,
          question_history: (importData.question_history || []).length,
          osce_history: (importData.osce_history || []).length,
        },
        warnings: mode === "replace" ? ["Replace mode will overwrite all existing learning data"] : [],
      };
      console.log(`[import] Simulation complete for user ${userId}`);
      return new Response(JSON.stringify(preview), { headers: h });
    }

    // ── Step 7: Snapshot current state ──
    step = "snapshot";
    const [rRes, bRes, sRes, pRes] = await Promise.all([
      supabase.from("readiness_dna").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("behavior_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("subject_dna").select("*").eq("user_id", userId),
      supabase.from("performance_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const snapshot = {
      readiness: rRes.data,
      behavior: bRes.data,
      subjectDna: sRes.data,
      performance: pRes.data,
    };

    const results: Record<string, string> = {};

    // ── Step 8: Import readiness_dna ──
    if (importData.accuracy_metrics) {
      step = "readiness_dna";
      const am = importData.accuracy_metrics;
      if (mode === "replace") {
        const { error } = await supabase.from("readiness_dna").upsert({
          user_id: userId,
          clinical_accuracy: am.clinical_accuracy ?? 0,
          answer_stability: am.answer_stability ?? 0,
          confidence_calibration: am.confidence_calibration ?? 0,
          readiness_score: am.readiness_score ?? 0,
          time_management: importData.timing_patterns?.avg_time_seconds ?? 0,
          attempt_count: am.total_attempts ?? 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error) throw new Error(`readiness_dna upsert: ${error.message}`);
        results.readiness_dna = "replaced";
      } else {
        const existing = rRes.data;
        const ec = existing?.attempt_count ?? 0;
        const ic = am.total_attempts ?? 0;
        const tc = ec + ic;
        if (tc > 0) {
          const m = (a: number, b: number) => Math.round(((a * ec) + (b * ic)) / tc * 100) / 100;
          const { error } = await supabase.from("readiness_dna").upsert({
            user_id: userId,
            clinical_accuracy: m(existing?.clinical_accuracy ?? 0, am.clinical_accuracy ?? 0),
            answer_stability: m(existing?.answer_stability ?? 0, am.answer_stability ?? 0),
            confidence_calibration: m(existing?.confidence_calibration ?? 0, am.confidence_calibration ?? 0),
            readiness_score: m(existing?.readiness_score ?? 0, am.readiness_score ?? 0),
            time_management: m(existing?.time_management ?? 0, importData.timing_patterns?.avg_time_seconds ?? 0),
            attempt_count: tc,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          if (error) throw new Error(`readiness_dna merge: ${error.message}`);
        }
        results.readiness_dna = "merged";
      }
    }

    // ── Step 9: Import behavior_profiles ──
    if (importData.behavioral_patterns) {
      step = "behavior_profiles";
      const bp = importData.behavioral_patterns;
      const bData: any = {
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

      if (mode === "replace" || !bRes.data) {
        const { error } = await supabase.from("behavior_profiles").upsert(bData, { onConflict: "user_id" });
        if (error) throw new Error(`behavior_profiles upsert: ${error.message}`);
        results.behavior_profiles = mode === "replace" ? "replaced" : "created";
      } else {
        const avg = (a: number, b: number) => Math.round(((a + b) / 2) * 100) / 100;
        const { error } = await supabase.from("behavior_profiles").update({
          rush_index: avg(bRes.data.rush_index ?? 0, bp.rush_index ?? 0),
          hesitation_index: avg(bRes.data.hesitation_index ?? 0, bp.hesitation_index ?? 0),
          fatigue_index: avg(bRes.data.fatigue_index ?? 0, bp.fatigue_index ?? 0),
          trap_flags: [...new Set([...(bRes.data.trap_flags as any[] || []), ...(bp.trap_flags || [])])],
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        if (error) throw new Error(`behavior_profiles merge: ${error.message}`);
        results.behavior_profiles = "merged";
      }
    }

    // ── Step 10: Import subject_dna ──
    if (Array.isArray(importData.difficulty_mapping)) {
      step = "subject_dna";
      let processed = 0;
      for (const subj of importData.difficulty_mapping) {
        if (!subj.subject) continue;
        const sd = {
          user_id: userId,
          subject: subj.subject,
          accuracy: subj.accuracy ?? 0,
          attempt_count: subj.attempt_count ?? 0,
          avg_time: subj.avg_time ?? 0,
          stability: subj.stability ?? 0,
          gap_score: subj.gap_score ?? 0,
          updated_at: new Date().toISOString(),
        };

        if (mode === "replace") {
          const { error } = await supabase.from("subject_dna").upsert(sd, { onConflict: "user_id,subject" });
          if (error) throw new Error(`subject_dna upsert (${subj.subject}): ${error.message}`);
        } else {
          const existing = (sRes.data || []).find((s: any) => s.subject === subj.subject);
          if (existing) {
            const ec = existing.attempt_count ?? 0;
            const ic = subj.attempt_count ?? 0;
            const tc = ec + ic;
            const m = (a: number, b: number) => tc > 0 ? Math.round(((a * ec) + (b * ic)) / tc * 100) / 100 : 0;
            const { error } = await supabase.from("subject_dna").update({
              accuracy: m(existing.accuracy ?? 0, subj.accuracy ?? 0),
              attempt_count: tc,
              avg_time: m(existing.avg_time ?? 0, subj.avg_time ?? 0),
              stability: m(existing.stability ?? 0, subj.stability ?? 0),
              gap_score: m(existing.gap_score ?? 0, subj.gap_score ?? 0),
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId).eq("subject", subj.subject);
            if (error) throw new Error(`subject_dna merge (${subj.subject}): ${error.message}`);
          } else {
            const { error } = await supabase.from("subject_dna").insert(sd);
            if (error) throw new Error(`subject_dna insert (${subj.subject}): ${error.message}`);
          }
        }
        processed++;
      }
      results.subject_dna = `${processed} subjects ${mode === "replace" ? "replaced" : "merged"}`;
    }

    // ── Step 11: Import performance_profiles ──
    if (importData.clinical_reasoning_nodes?.performance_profile) {
      step = "performance_profiles";
      const pp = importData.clinical_reasoning_nodes.performance_profile;
      const { error } = await supabase.from("performance_profiles").upsert({
        user_id: userId,
        clinical_accuracy: pp.clinical_accuracy ?? 0,
        stability_score: pp.stability_score ?? 0,
        time_sensitivity: pp.time_sensitivity ?? 0,
        confidence_gap: pp.confidence_gap ?? 0,
        readiness_score: pp.readiness_score ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw new Error(`performance_profiles upsert: ${error.message}`);
      results.performance_profiles = mode === "replace" ? "replaced" : "updated";
    }

    // ── Step 12: Write history ──
    step = "history";
    const { data: lastVersion } = await supabase
      .from("data_export_history")
      .select("version")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const { error: histErr } = await supabase.from("data_export_history").insert({
      user_id: userId,
      action_type: "import",
      merge_mode: mode,
      version: nextVersion,
      snapshot_data: snapshot,
      file_name: `import_v${nextVersion}`,
    });
    if (histErr) console.error("[import] history write failed:", histErr.message);

    console.log(`[import] Complete for user ${userId}, version ${nextVersion}, results:`, results);

    return new Response(JSON.stringify({
      success: true,
      message: "Learning model updated successfully.",
      version: nextVersion,
      results,
    }), { headers: h });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`[import] Error at step "${step}":`, msg);
    return new Response(JSON.stringify({
      success: false,
      error: msg,
      step,
    }), { status: 500, headers: h });
  }
});

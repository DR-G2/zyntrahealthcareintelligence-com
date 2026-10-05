import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DEFAULT_INFERENCE_CONFIG,
  initialCandidateState,
  updateCandidateState,
  type CandidateState,
  type PieObservation,
  deriveDynamics,
} from "../../../src/lib/pie/inference/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "server_configuration_error" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const requestedUserId = body?.user_id;
  if (requestedUserId && requestedUserId !== user.id) {
    return json({ error: "user_scope_violation" }, 403);
  }

  const userId = user.id;
  const modelVersion = DEFAULT_INFERENCE_CONFIG.modelVersion;

  const { data: priorRow } = await serviceClient
    .from("pie_candidate_state")
    .select("*")
    .eq("user_id", userId)
    .order("state_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  let state: CandidateState | undefined;
  if (priorRow) {
    const { data: uncertainty } = await serviceClient
      .from("pie_state_uncertainty")
      .select("*")
      .eq("candidate_state_id", priorRow.id);

    const byDimension = new Map((uncertainty ?? []).map((u) => [u.state_dimension, u]));
    const makePosterior = (dimension: string, estimate: number | null) => {
      const u = byDimension.get(dimension);
      return {
        estimate: estimate ?? 0.5,
        variance: Number(u?.variance ?? 0.25),
        lower: Number(u?.lower_bound ?? 0),
        upper: Number(u?.upper_bound ?? 1),
        confidenceLevel: Number(u?.confidence_level ?? 0.95),
        evidenceCount: Number(u?.evidence_count ?? 0),
        evidenceQuality: Number(u?.evidence_quality ?? 0),
      };
    };

    state = {
      timestamp: priorRow.state_timestamp,
      sequence: Number(priorRow.state_sequence),
      capability: makePosterior("CAPABILITY", Number(priorRow.capability_estimate)),
      decision: makePosterior("DECISION", Number(priorRow.decision_estimate)),
      timing: makePosterior("TIMING", Number(priorRow.timing_estimate)),
      calibration: makePosterior("CALIBRATION", Number(priorRow.calibration_estimate)),
      sustainedPerformance: makePosterior("SUSTAINED_PERFORMANCE", Number(priorRow.sustained_performance_estimate)),
      learning: makePosterior("LEARNING", Number(priorRow.learning_estimate)),
      identificationStatus: priorRow.identification_status,
      evidenceLevel: priorRow.evidence_level,
      dataQuality: Number(priorRow.data_quality ?? 0),
      modelVersion: priorRow.model_version,
    };
  }

  const observationQuery = serviceClient
    .from("pie_observation")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: true });

  const { data: rows, error: observationError } = priorRow
    ? await observationQuery.gt("occurred_at", priorRow.state_timestamp)
    : await observationQuery;

  if (observationError) return json({ error: "observation_query_failed", detail: observationError.message }, 500);

  const observations: PieObservation[] = (rows ?? []).map((row) => ({
    occurredAt: row.occurred_at,
    outcome: row.outcome,
    confidenceNormalized: row.confidence_normalized,
    timeTotalMs: row.time_total_ms,
    timeToFirstInteractionMs: row.time_to_first_interaction_ms,
    timeToAnswerMs: row.time_to_answer_ms,
    timePostDecisionMs: row.time_post_decision_ms,
    firstAnswerCorrect: row.first_answer_correct,
    finalAnswerCorrect: row.final_answer_correct,
    answerChanges: row.answer_changes,
    changeDirection: row.change_direction,
    observationQuality: row.observation_quality,
    interruptionActive: row.interaction_state === "INTERRUPTED",
  }));

  if (!observations.length) {
    return json({
      status: "no_observations",
      state: state ?? initialCandidateState(undefined, DEFAULT_INFERENCE_CONFIG),
    });
  }

  let next = state;
  for (const observation of observations) {
    next = updateCandidateState(next, observation, DEFAULT_INFERENCE_CONFIG);
  }

  const uncertainty = {
    capability: next.capability,
    decision: next.decision,
    timing: next.timing,
    calibration: next.calibration,
    sustained_performance: next.sustainedPerformance,
    learning: next.learning,
  };

  const { data: persisted, error: persistError } = await serviceClient.rpc(
    "pie_persist_state_snapshot",
    {
      p_user_id: userId,
      p_model_version: next.modelVersion,
      p_state: next,
      p_uncertainty: uncertainty,
      p_observation_count: observations.length,
    },
  );

  if (persistError) return json({ error: "state_persist_failed", detail: persistError.message }, 500);

  const persistedState = persisted?.[0];
  const { data: recentStates } = await serviceClient
    .from("pie_candidate_state")
    .select("*")
    .eq("user_id", userId)
    .order("state_sequence", { ascending: false })
    .limit(60);

  let dynamic = null;
  if (recentStates?.length) {
    const history: CandidateState[] = recentStates
      .reverse()
      .map((row) => ({
        timestamp: row.state_timestamp,
        sequence: Number(row.state_sequence),
        capability: {
          estimate: Number(row.capability_estimate ?? 0.5),
          variance: 0.1,
          lower: 0,
          upper: 1,
          confidenceLevel: 0.95,
          evidenceCount: Number(row.observation_count ?? 0),
          evidenceQuality: Number(row.data_quality ?? 0),
        },
        decision: {
          estimate: Number(row.decision_estimate ?? 0.5),
          variance: 0.1,
          lower: 0,
          upper: 1,
          confidenceLevel: 0.95,
          evidenceCount: Number(row.observation_count ?? 0),
          evidenceQuality: Number(row.data_quality ?? 0),
        },
        timing: {
          estimate: Number(row.timing_estimate ?? 0.5),
          variance: 0.1,
          lower: 0,
          upper: 1,
          confidenceLevel: 0.95,
          evidenceCount: Number(row.observation_count ?? 0),
          evidenceQuality: Number(row.data_quality ?? 0),
        },
        calibration: {
          estimate: Number(row.calibration_estimate ?? 0.5),
          variance: 0.1,
          lower: 0,
          upper: 1,
          confidenceLevel: 0.95,
          evidenceCount: Number(row.observation_count ?? 0),
          evidenceQuality: Number(row.data_quality ?? 0),
        },
        sustainedPerformance: {
          estimate: Number(row.sustained_performance_estimate ?? 0.5),
          variance: 0.1,
          lower: 0,
          upper: 1,
          confidenceLevel: 0.95,
          evidenceCount: Number(row.observation_count ?? 0),
          evidenceQuality: Number(row.data_quality ?? 0),
        },
        learning: {
          estimate: Number(row.learning_estimate ?? 0.5),
          variance: 0.1,
          lower: 0,
          upper: 1,
          confidenceLevel: 0.95,
          evidenceCount: Number(row.observation_count ?? 0),
          evidenceQuality: Number(row.data_quality ?? 0),
        },
        identificationStatus: row.identification_status,
        evidenceLevel: row.evidence_level,
        dataQuality: Number(row.data_quality ?? 0),
        modelVersion: row.model_version,
      }));

    const derived = deriveDynamics(history);
    dynamic = {
      ...derived,
      user_id: userId,
      candidate_state_id: persistedState?.state_id ?? null,
      state_timestamp: next.timestamp,
      state_sequence: persistedState?.state_sequence ?? next.sequence,
      model_version: next.modelVersion,
      identification_status: next.identificationStatus,
      evidence_quality: next.dataQuality,
      evidence_count: observations.length,
    };

    await serviceClient.from("pie_dynamic_state").insert(dynamic);
  }

  return json({
    status: "completed",
    model_version: next.modelVersion,
    observation_count: observations.length,
    state: next,
    persisted: persisted?.[0] ?? null,
  });
});

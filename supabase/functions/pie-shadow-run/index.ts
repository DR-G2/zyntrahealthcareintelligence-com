import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { orchestrate } from "../../../src/lib/pie/runtime/index.ts";
import { initialCandidateState } from "../../../src/lib/pie/inference/types.ts";
import type { QuestionState } from "../../../src/lib/pie/question/types.ts";

const allowedOrigin = Deno.env.get("PIE_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com";
const headers = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !key || !auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });

  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? key, { global: { headers: { Authorization: auth } } });
  const service = createClient(url, key);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });

  const modelVersion = "pie-runtime-shadow-0.1";
  const state = initialCandidateState(new Date().toISOString());
  const { data: run, error: runError } = await service
    .from("pie_shadow_run")
    .insert({ user_id: user.id, model_version: modelVersion, candidate_facing: false, legacy_authoritative: true })
    .select("id")
    .single();
  if (runError) return new Response(JSON.stringify({ error: runError.message }), { status: 500, headers });

  const { data: questionRows } = await service
    .from("pie_question_state")
    .select("*")
    .eq("production_status", "PRODUCTION")
    .limit(25);

  const questionIds = (questionRows ?? []).map((q) => q.question_id);
  const { data: uncertaintyRows } = questionIds.length
    ? await service.from("pie_question_uncertainty")
        .select("*")
        .in("question_id", questionIds)
    : { data: [] };

  const uncertaintyByKey = new Map(
    (uncertaintyRows ?? []).map((u) => [
      `${u.question_id}:${u.question_version}:${String(u.parameter_name).toUpperCase()}`,
      u,
    ]),
  );

  const posterior = (q: Record<string, unknown>, parameter: string, fallback: number) => {
    const key = `${q.question_id}:${q.question_version}:${parameter}`;
    const u = uncertaintyByKey.get(key);
    const estimate = Number(q[`${parameter.toLowerCase()}_estimate`] ?? fallback);
    const variance = Number(u?.uncertainty_measure ?? 0.16);
    return {
      estimate: Math.max(0, Math.min(1, estimate)),
      variance: Math.max(0, variance),
      lower: Math.max(0, Math.min(1, Number(u?.lower_bound ?? estimate - Math.sqrt(variance) * 1.96))),
      upper: Math.max(0, Math.min(1, Number(u?.upper_bound ?? estimate + Math.sqrt(variance) * 1.96))),
      evidenceCount: Number(u?.evidence_count ?? 0),
      evidenceQuality: Number(u?.evidence_quality ?? 0),
    };
  };

  const protectedLevels = new Set([
    "EXPERT_METADATA",
    "INITIAL_PRODUCTION",
    "OBSERVED_PSYCHOMETRIC",
  ]);

  const questions: QuestionState[] = (questionRows ?? []).map((q) => ({
    questionId: String(q.question_id),
    questionVersion: String(q.question_version),
    difficulty: posterior(q, "DIFFICULTY", 0.5),
    discrimination: posterior(q, "DISCRIMINATION", 0.5),
    ambiguity: posterior(q, "AMBIGUITY", 0.1),
    novelty: posterior(q, "NOVELTY", 0.5),
    evidenceLevel: q.evidence_level,
    productionStatus: q.production_status,
    modelVersion: String(q.model_version),
    protected: protectedLevels.has(String(q.evidence_level)),
    uniqueCandidateCount: Number(q.evidence_count ?? 0),
    candidateIdsSeen: [],
  } as QuestionState));
  const result = orchestrate({
    candidate: state,
    questions,
    context: "CAPABILITY",
    mode: "SHADOW",
  });

  await service.from("pie_runtime_decision").insert({
    user_id: user.id,
    decision_context: result.decision.context,
    mode: "SHADOW",
    candidate_state_sequence: result.decision.candidateStateSequence,
    candidate_model_version: result.decision.modelVersions.candidate,
    question_model_version: result.decision.modelVersions.question,
    dwig_model_version: result.decision.modelVersions.dwig,
    intervention_model_version: result.decision.modelVersions.intervention,
    selected_question_id: result.decision.selectedQuestionId,
    selected_question_version: result.decision.selectedQuestionVersion,
    selected_intervention_id: result.decision.interventionId,
    uncertainty: result.decision.uncertainty,
    rationale: result.decision.rationale,
    candidate_facing: false,
    promotion_allowed: false,
  });

  await service.from("pie_shadow_run").update({
    ended_at: new Date().toISOString(),
    observation_count: 0,
    decision_count: 1,
    status: "COMPLETED",
  }).eq("id", run.id);

  return new Response(JSON.stringify({
    status: "shadow_completed",
    shadow_run_id: run.id,
    candidate_facing: false,
    legacy_authoritative: true,
    selected_question_id: result.decision.selectedQuestionId,
    promotion_allowed: false,
  }), { headers });
});

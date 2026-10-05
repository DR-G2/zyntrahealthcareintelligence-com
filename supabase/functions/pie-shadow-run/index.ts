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

  const questions: QuestionState[] = (questionRows ?? []).map((q) => ({
    questionId: q.question_id ?? q.id,
    questionVersion: q.question_version ?? q.version ?? "unknown",
    difficulty: q.difficulty,
    discrimination: q.discrimination,
    ambiguity: q.ambiguity,
    novelty: q.novelty,
    evidenceLevel: q.evidence_level,
    productionStatus: q.production_status,
    modelVersion: q.model_version,
    protected: q.protected,
    uniqueCandidateCount: q.unique_candidate_count ?? 0,
    candidateIdsSeen: q.candidate_ids_seen ?? [],
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

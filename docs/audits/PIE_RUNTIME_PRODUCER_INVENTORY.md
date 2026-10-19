# PIE Runtime Producer-to-UI Inventory

Status: Phase 1 baseline. Read-only production inspection plus source inspection; no persistent database changes made.

## Scope and evidence
- Production Supabase project inspected: `hkowvjazuwebmibssdut`.
- Git source inspected at `main` commit `0fbc678ead3544793daca9317ac6e127af5d0717`, plus remediation branch `fix/pie-metric-semantics`.
- CI on PR #155 head `e5490b3f83602cdd9075c21b725ad163c15b06d0` passed Zyntra CI, PIE live certification, full-history regression, P21.1 telemetry integrity, and P21.2 decision-trace integrity. These are code/workflow gates, not proof that every formula is valid.
- No persistent migration applied and no candidate records rewritten as part of this inventory.

## Runtime paths identified

| Path | Producer/source | Persisted output | Consumer | Baseline status |
|---|---|---|---|---|
| V2 intelligence aggregate | `intelligence.rebuild_candidate(uuid)`, production function exists | `intelligence.behavior_dna`, `confidence_intelligence`, `readiness_dna`, `subject_dna`, `next_best_actions` | learner views `my_behavior_dna`, `my_confidence_intelligence`, `my_readiness`, `my_subject_dna`, `my_next_best_actions`; legacy pages also query tables | Confirmed live producer; old source formula has neutral confidence fallback, timing in composite readiness, and fatigue = answer instability |
| V2 authoritative PIE state | `pie.rebuild_candidate_state(uuid)`, production function exists; wrapper `public.rebuild_candidate_state(uuid)` | `pie.pie_candidate_state`, `pie.pie_inference_run`; model version `candidate-state/v2.1` | `public.my_pie_state` / `get_my_pie_state`, `src/lib/pie/pie-state.ts`, PIE UI | Confirmed live producer. Reads `pie.pie_observation`; derives multiple dimensions from shared aggregate signals, uses neutral fallbacks and global evidence count. Requires separate semantic audit. |
| AMC readiness adapter | `public.rebuild_my_amc_readiness(text)`; reader `public.get_my_amc_readiness(text)` | `public.amc_adapter_evaluation` | AMC readiness API/UI consumers | Confirmed live function path. Explicitly returns probability null / NOT_CALIBRATED, but its readiness index and interval construction require separate validity review. |
| Edge behavior analysis | source `supabase/functions/analyze-behavior/index.ts`; UI caller `src/pages/BehaviorProfile.tsx`; V2 history adapter `supabase/functions/_shared/pie-v2-history.ts` | reads/writes legacy-named behavior/profile/history tables (full output contract still needs trace) | Behavior Profile page | Source caller exists, but `analyze-behavior` was not present in the first returned page of active production Edge Functions. Deployment status is **unconfirmed**, not assumed absent. |
| Frontend evidence adapter | `src/lib/pie/intelligence-evidence.ts` | none | PIE dashboard modules | On `main`, readiness is read from `my_readiness`, confidence from `my_confidence_intelligence`, action from `my_next_best_actions`, and PIE state from `my_pie_state`. A remediation branch changes confidence semantics and per-dimension gating; it is not merged. |
| History / legacy adapter | `src/lib/pie/pie-history-client.ts` calls `get_my_attempt_history`; `toLegacyAttempt` maps absent answer keys to empty string | none | history pages and Edge Function adapters | Source comments say answer keys are withheld until session completion; consumers must not treat empty key as a valid answer key. |

## Confirmed source-level formula risks

1. `intelligence.rebuild_candidate` on `main`: confidence defaults to 0.5 with no valid confidence; over/underconfidence default to 0; timing contributes to readiness; fatigue is calculated as `1 - answer stability`; rush and hesitation are inverses of a generic timing score.
2. `pie.rebuild_candidate_state` in live production: confidence, timing, and answer-change signals default to neutral values when missing; calibration is derived from aggregate confidence vs aggregate accuracy, not a validated calibration estimator; capability, sustained performance, and learning all reuse the same accuracy estimate; uncertainty is based on observation count, not empirically calibrated residuals.
3. `public.rebuild_my_amc_readiness`: current source explicitly avoids claiming calibrated pass probability, but calculates an index and bounds from aggregate PIE estimates/uncertainty. Those values must remain an engineering index until calibration and coverage are demonstrated.
4. `src/lib/pie/intelligence-evidence.ts` on `main`: global evidence count and evidence level are used for sufficiency; per-dimension evidence counts are parsed but not included in the sufficiency decision. PR #155 attempts to gate per dimension.
5. `supabase/functions/analyze-behavior/index.ts` on `main`: missing times are treated as zero; change rate counts number of changes per attempt rather than share of attempts changed; fatigue compares halves of the aggregate attempts rather than a guaranteed single chronological session; Trust Your Gut needs strict key/first-choice eligibility.
6. `src/lib/pie/validation/candidate-model.ts` explicitly identifies itself as a development-only heuristic and not the final hierarchical dynamic state-space model. Its uncertainty is a heuristic evidence factor, not a calibrated interval.
7. Production table `public.question_retirement_backup_20261014` has RLS disabled. This is a separate security finding; do not enable RLS blindly without reviewing intended access, ownership, and backup/retention requirements.

## Release boundary
- Do not apply migration `0081_pie_metric_semantics.sql` yet. The PR is draft and migration has only been transactionally parsed/rolled back.
- Do not label any readiness score as an AMC pass probability or exam-ready prediction without outcome validation.
- Do not treat a missing observation as a measured neutral value.
- Do not replace or remove the `pie.*` authoritative state pipeline while changing the `intelligence.*` aggregate path; these are distinct runtime contracts.
- Phase 2 starts with metric definitions and producer tests for accuracy, answer stability, timing, confidence alignment, rush/slow-response, and fatigue. Each metric must have a named denominator, missing-data rule, evidence threshold, version, and deterministic boundary tests before implementation.

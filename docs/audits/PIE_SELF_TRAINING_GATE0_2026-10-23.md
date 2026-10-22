# PIE self-training Gate 0: read-only audit findings

**Audit date:** 2026-10-23  
**Scope:** read-only Supabase schema/count/quality queries and read-only repository inspection  
**Production mutations:** none  
**Training run:** not started  
**Model promotion:** prohibited

## Findings

| Check | Observed result | Gate interpretation |
|---|---:|---|
| `public.user_attempts` | 3,323 rows; 6 distinct user IDs | Too few independent candidates to support robust learner-held-out evaluation |
| `intelligence.behavior_events` | 3,785 rows; 7 distinct user IDs | Reconcile event coverage and identity population |
| `pie.pie_observation` | 3,785 rows; 7 distinct user IDs | Contains more rows than attempts; null question/attempt IDs need classification |
| `pie.learner_lo_state` | 833 rows | Existing state is a comparator, not ground truth |
| `pie.pie_inference_run` | 838 completed runs | Existing inference outputs are not labels |
| `pie.decision_trace` | 4,092 rows | Use only decision snapshots recorded before each target outcome |
| `pie.adaptive_policy_shadow` | 833 rows | Shadow baseline only; scores are not assumed calibrated probabilities |
| `pie.pie_intervention_outcome` | 0 rows | Intervention outcome training blocked |
| `pie.pie_intervention_effect_estimate` | 0 rows | No effect estimates to validate |
| `pie.synthetic_candidate_registry` | 0 rows | Registry emptiness does not establish that users are genuine |
| `public.questions` | 1,458 rows, all active, provenance present | Conflicts with the previously inspected V2 cutover document's 225-question inventory; reconcile snapshot/time/scope |

## Attempt provenance

Observed source labels and row counts:

| Source label | Attempts | Distinct users |
|---|---:|---:|
| `pie-live-certification` | 1,817 | 2 |
| `P21.1-certification` | 328 | 3 |
| `P20-certification` | 296 | 2 |
| `nudge-live-certification` | 290 | 1 |
| `P21.2-certification` | 257 | 2 |
| `practice-pie` | 229 | 2 |
| `P21.3-certification` | 94 | 2 |
| `P19-certification` | 4 | 1 |
| `P18-certification` | 4 | 1 |
| `P17-certification` | 4 | 1 |

The provenance counts sum to all 3,323 attempts in the current snapshot. Only `practice-pie` is not explicitly certification-labelled in this list. It is **not automatically approved**: its label does not prove genuine candidate activity, consent, representativeness or lawful training use.

## Integrity observations

- All 3,323 saved attempts have a linked `pie.pie_observation` via `attempt_id`; no orphan observations were found where a non-null observation attempt ID failed to join.
- Comparing the latest linked observation with the attempt row found zero mismatches in correctness, confidence, selected answer, or a non-null observation question-version provenance field.
- 462 observations have no `attempt_id` and no `question_id`; they should be classified as non-attempt events or excluded from the initial attempt/question/LO dataset until their semantics are verified.
- One observation lacked an `is_correct` payload field; 101 observations lacked confidence. Ten attempts lacked confidence; no out-of-range attempt confidence values were observed.
- 683 attempts have a missing `question_version`; 2,640 attempt versions match the current question version, and no non-null attempt versions differed from the current version. Do not backfill historical versions from the current question row without verified history.
- Four attempts have no matching `public.practice_sessions` row. They require session-context review or exclusion from features that depend on session metadata.
- One observation was labelled `p12_certification_seed`; the other 3,784 were labelled `public.save_attempt`.
- All 1,458 questions have exactly one primary question-to-LO mapping in the aggregate checks.
- The observation/attempt consistency check covers the latest linked observation per attempt; it does not prove that every additional observation is valid or that historical question text/version is recoverable.

## Gate status

**Gate 0: BLOCKED.**

Blocking reasons:

1. Human/test/certification source eligibility has not been independently verified.
2. The sample contains only six distinct user IDs, making robust unseen-candidate evaluation impossible.
3. The production question-inventory discrepancy is unresolved.
4. Missing attempt question versions and session rows need explicit handling.
5. Consent/purpose and data-minimisation approval must be established before human-data training.

## Next permitted actions

1. Have the source owner classify `practice-pie` and any other candidate data sources with documented evidence.
2. Resolve the live question inventory discrepancy.
3. Run the committed read-only SQL quality audit in a restricted environment and record aggregate results for repeatability.
4. Verify question-version history and decide the documented exclusion policy for missing versions/session rows.
5. Build the point-in-time dataset only after Gate 0 is explicitly marked passed.

No production schema, data, selector, Edge Function, or model was changed during this audit.

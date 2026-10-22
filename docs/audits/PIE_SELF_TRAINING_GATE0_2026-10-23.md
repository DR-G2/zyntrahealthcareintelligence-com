# PIE self-training Gate 0: read-only audit findings

**Audit date:** 2026-10-23  
**Scope:** read-only Supabase schema/count/quality queries and read-only repository inspection  
**Production mutations:** none  
**Training run:** not started  
**Model promotion:** prohibited

## Findings

| Check | Observed result | Gate interpretation |
|---|---:|---|
| `public.user_attempts` | 3,323 rows; 6 distinct user IDs | Too few independent candidates to support a robust learner-held-out evaluation |
| `intelligence.behavior_events` | 3,785 rows; 7 distinct user IDs | Must reconcile event coverage and identity population |
| `pie.pie_observation` | 3,785 rows; 7 distinct user IDs | Contains more rows than attempts; observation types and null question IDs need classification |
| `pie.learner_lo_state` | 833 rows | Existing state is a comparator, not ground truth |
| `pie.pie_inference_run` | 838 completed runs | Existing inference outputs are not labels |
| `pie.decision_trace` | 4,092 rows | Decision evidence exists; must use only snapshots preceding each target outcome |
| `pie.adaptive_policy_shadow` | 833 rows | Shadow baseline only; scores are not assumed calibrated probabilities |
| `pie.pie_intervention_outcome` | 0 rows | Intervention outcome training blocked |
| `pie.pie_intervention_effect_estimate` | 0 rows | No effect estimates to validate |
| `pie.synthetic_candidate_registry` | 0 rows | Registry emptiness does not establish that users are genuine |
| `public.questions` | 1,458 rows, all currently marked active, provenance present | Conflicts with the previously inspected V2 cutover document's 225-question inventory; reconcile snapshot/time/scope |

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

The provenance counts sum to all 3,323 attempts in the current snapshot. Only `practice-pie` is not explicitly certification-labelled in this list. It is **not automatically approved**: the source label alone does not prove genuine candidate activity, consent, representativeness or lawful training use.

## Integrity observations

- All 3,323 saved attempts joined to at least one `pie.pie_observation` through `attempt_id`; no orphan observations were found where a non-null observation attempt ID failed to join.
- Ten attempts had missing or out-of-range confidence values.
- One observation had a missing `is_correct` payload field; 101 observations had missing confidence payloads.
- 462 PIE observations and 462 behaviour events had no question ID. Those rows cannot enter the initial attempt/question/LO training set without a separate validated interpretation.
- 1 observation was labelled `p12_certification_seed`; the other 3,784 were labelled `public.save_attempt`.
- All 1,458 questions had a primary question-to-LO mapping in the aggregate check. Uniqueness and historical mapping validity still require the audit SQL's detailed query to be run and reviewed.
- Attempt-to-observation link coverage does not prove the observation's payload values match the attempt row. A row-level, privacy-controlled consistency check remains required.

## Gate status

**Gate 0: BLOCKED.**

Blocking reasons:

1. Human/test/certification source eligibility has not been independently verified.
2. The sample contains only six distinct user IDs, making robust unseen-candidate evaluation impossible.
3. The production question-inventory discrepancy is unresolved.
4. Observation payload and missing-question semantics require review.
5. Consent/purpose and data-minimisation approval must be established before human-data training.

## Next permitted actions

1. Have the source owner classify `practice-pie` and any other candidate data sources with documented evidence.
2. Resolve the live question inventory discrepancy.
3. Run the read-only SQL quality audit in a restricted environment and record aggregate results.
4. Validate observation-versus-attempt field consistency without committing row-level data.
5. Build the point-in-time dataset only after Gate 0 is explicitly marked passed.

No production schema, data, selector, Edge Function, or model was changed during this audit.

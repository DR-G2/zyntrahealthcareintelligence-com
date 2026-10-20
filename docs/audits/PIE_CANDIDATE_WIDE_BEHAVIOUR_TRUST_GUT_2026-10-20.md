# PIE Candidate-Wide Behaviour and Trust Your Gut

Date: 2026-10-20
Scope: source changes on `fix/pie-behavior-profile-v2-owner`; no production deployment or database mutation.

## Contract

- Performance remains the outcome view.
- Behaviour is one evolving candidate-wide view of response timing, answer changes, block patterns and subject patterns.
- Trust Your Gut is one candidate-wide view of first recorded answer versus final answer outcomes.
- Practice mode remains attached to each eligible attempt and is surfaced as supporting context, not a separate candidate profile or a mode selector.
- Candidate-wide means pooling only comparable, explicitly labelled MCQ attempt evidence. It does not mean treating all activity types as interchangeable.

## Eligible evidence

Behaviour analysis includes completed attempts with a non-empty answer key and boolean correctness from explicitly labelled `normal`, `normal_mcq`, `amc_exam`, `mock_practice` and `nudge` modes. It excludes ambiguous/legacy labels and OSCE until a comparable telemetry contract is verified. The mode-level attempt count, accuracy, timing and answer-change evidence are retained in `archetype_signals.modeBreakdown`.

Trust Your Gut uses explicitly recognized practice modes and retains mode counts in the UI. First-answer versus final-answer classification continues to require a consistent recorded answer-change sequence and completed answer-key evidence. Missing or inconsistent evidence remains unavailable rather than zero.

## Storage and rollout

New Behaviour analyses write the profile row with `session_mode = 'candidate_wide'`. Migration `0104_candidate_wide_behavior_profile.sql` permits both `candidate_wide` and the legacy `normal_mcq` value during rollout. This is deliberate: a pre-existing Normal MCQ row must not cause the migration to fail. The UI withholds any legacy row from the candidate-wide presentation and prompts an authenticated refresh; successful analysis replaces it with the candidate-wide profile. The migration is source-only and has **not** been applied to production. The deployed Edge Function has **not** been updated by this PR.

## Required verification

- Unit tests prove cross-mode inclusion, preservation of mode labels, exclusion of unknown modes/OSCE, and rejection of missing answer keys.
- Trust Your Gut tests prove the view no longer requires a mode selector and continues to preserve unavailable change evidence.
- Run CI on the final PR head. Green CI does not certify the authenticated live Edge Function or prove the migration has been deployed.
- Before production rollout, apply the migration only with explicit authorization, deploy the matching Edge Function source, and perform authenticated runtime verification with the owner-scoped V2 history and profile view.

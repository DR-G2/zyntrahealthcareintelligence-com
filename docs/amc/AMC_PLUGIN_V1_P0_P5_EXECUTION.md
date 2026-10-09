# AMC Plugin v1: P0-P5 execution ledger

Updated: 2026-10-09  
Working branch: `amc/p0-p5-integration-green`  
Draft PR: #76  
Scope: engineering contract, blueprint, question/task metadata, environment, readiness boundary, and PIE/DWIG selection.

## P0 - Contract and runtime reconciliation

**Code work**
- Source-controlled `amc-intelligence` now includes the live `get_readiness` action.
- Invalid exam modes are rejected instead of silently coerced to MCQ.
- Candidate readiness responses are allow-listed. Raw RPC error detail and unvalidated PIE composite values are not returned.
- A versioned content-context registry is defined for both MCQs and clinical stations in both migration tracks because the live V2 database has the public AMC runtime schema alongside the separate `amc.*` adapter schema.

**Observed live state**
- The deployed `amc-intelligence` function was ahead of the source version: it had `get_readiness`, while source did not.
- `public.amc_question_context` was absent.
- The live project contains both `public.amc_*` runtime tables and `amc.*` adapter tables. They are distinct contracts and must not be conflated.

**Gate:** code reconciliation implemented in the draft branch; deployment parity remains unverified until CI passes and the function is deployed and smoke-tested.

## P1 - Blueprint

- MCQ proportions are 30%, 20%, and four groups at 12.5% each.
- Independent rounding creates 151 items. The simulator's allocation helper is now tested to allocate exactly 150 while preserving the major-group targets.
- The live blueprint has six MCQ rows whose proportions sum to 1.
- The MCQ and clinical environments are currently `VALIDATING`, not `ACTIVE`.

**Gate:** engineering allocation contract covered by tests; no claim that the proprietary AMC CAT algorithm is reproduced.

## P2 - Question/task intelligence

- The question-context table and its review metadata are defined.
- The runtime now has a status action for mapped/approved question counts.
- Candidate UI explicitly reports that AMC-specific question delivery is disabled when mapping or selector gates are missing.
- No question mappings were found in live `public.amc_question_context` because that table did not exist.
- Live `amc.amc_lo_taxonomy` and `amc.amc_blueprint_lo` both had zero rows.
- The live 225-question pool is split across nine basic-science subjects. It must not be automatically relabelled as AMC clinical-vignette content without question-level review.

**Gate:** metadata contract implemented; real question-level mapping and clinical-content review remain required. No generic-question fallback is allowed for an AMC-labelled session.

## P3 - Environment

- MCQ and clinical environments are versioned and returned through the authenticated AMC Edge Function.
- The candidate-facing status panel shows plugin/environment status and blueprint row count only.
- Environment status remains `VALIDATING`; a valid configuration is not a certification.

**Gate:** configuration contract present; promotion to `ACTIVE` remains prohibited until the downstream readiness/validation gates pass.

## P4 - Readiness adapter

- The live readiness function previously averaged six PIE dimension estimates into a scalar and used the number of dimensions as `evidence_count`. This is not a validated AMC readiness formula.
- The draft migration removes the unvalidated composite, records an evidence snapshot without combining estimates, and returns `probability: null` with `INSUFFICIENT_EVIDENCE`.
- Direct readiness RPCs return only the sanitized contract.
- Model promotion now additionally requires `readiness_runtime_verified=true`; a passing metrics row alone cannot activate an unimplemented readiness runtime.

**Gate:** safety boundary implemented in source; scientific readiness remains uncalibrated until approved anonymized response data, independent calibration, holdout evaluation, and external review exist.

## P5 - PIE/DWIG decision boundary

- PIE already accepts a blueprint key, but the live AMC blueprint-to-LO map is empty. Without a guard, an unmapped AMC key can behave like generic selection.
- The draft migration seeds an explicit `ZYNTRA_GENERAL` key for ordinary practice and rejects AMC sessions until eligible blueprint-to-LO mappings exist.
- A second database guard rejects any AMC-session question that is not mapped to an eligible LO for the latest active blueprint and has approved, version-matched content metadata.
- Clinical stations are explicitly blocked from the MCQ PIE selector; the dedicated OSCE selector remains a separate integration requirement.
- Generic adaptive practice and generic diagnostics now pass the exam-neutral key explicitly.
- A local/staging SQL verification script covers both the AMC refusal and generic-practice continuity.

**Gate:** fail-closed logic and verification script are in the draft branch; not live-applied. Do not apply the guard migration until the frontend version that sends `ZYNTRA_GENERAL` for generic practice is deployed.

## Verification policy

The draft is not certified until:
1. GitHub build/test and validation checks are green on the final head SHA.
2. SQL migrations pass against a disposable/staging database in order.
3. Edge Function is deployed to the V2 project after its required schema migration.
4. Authenticated smoke tests cover `get_summary`, `get_blueprint`, `get_practice_status`, and `get_readiness`.
5. AMC sessions fail closed with no reviewed mappings, while generic PIE sessions still work.
6. A real, approved, anonymized response matrix supports independent calibration and holdout validation before any pass probability is shown.

A missing clinical mapping, an uncalibrated readiness model, or a pending live check is a blocker, not a green check.

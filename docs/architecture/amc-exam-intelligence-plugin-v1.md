# AMC Exam Intelligence Plugin v1

## Purpose
AMC-specific exam semantics are isolated from the exam-neutral PIE core.

AMC Plugin owns:
- AMC versioning
- exam environments
- blueprint configuration
- task taxonomy
- AMC question context
- AMC readiness adapter
- AMC decision context
- AMC intervention catalogue

PIE Core owns:
- candidate latent state
- uncertainty
- evidence
- dynamics
- DWIG
- intervention utility and causal validation

## Security boundary
Candidate UI -> authenticated Edge/API -> service_role -> AMC Plugin + PIE Core

Candidate clients must not directly read or write internal AMC or PIE intelligence tables.

Never expose candidate latent state, state uncertainty, question posterior parameters, DWIG calculations, hidden hypotheses, intervention effectiveness, causal estimates, certification gates, or other candidates' data.

Candidate-facing output must be a deliberately projected DTO.

## P0-P6 flow
P0 Contract -> P1 Blueprint/Taxonomy -> P2 Question Context -> P3 Exam Adapter/Readiness -> P4 Decision -> P5 Intervention -> P6 Outcome/learning loop

No P0-P6 component may change the PIE latent-state definition.

## v1 status
Development only.

The AMC MCQ environment intentionally contains no unverified official blueprint proportions. Official source-backed configuration is a separate data population step.

## Design rule
AMC semantics + PIE state -> AMC readiness

Readiness is not stored as a new latent state.

## Future
Clinical/OSCE can be added as another environment without changing the PIE core.

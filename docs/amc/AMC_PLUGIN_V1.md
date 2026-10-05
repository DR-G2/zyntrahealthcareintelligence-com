# Zyntra AMC Intelligence Plugin v1

## Purpose

AMC Plugin v1 is the exam-specific intelligence layer inside Zyntra. It adapts the exam-neutral PIE candidate model to AMC environments.

It does not replace PIE.

```
Candidate observations
        |
        v
      PIE CORE
 K / D / T / C / F / L
        |
        v
 AMC EXAM ADAPTER
        |
        +--> AMC blueprint
        +--> AMC task taxonomy
        +--> AMC environment
        +--> AMC target definition
        |
        v
 AMC readiness
        |
        v
 PIE DWIG / decision engine
        |
        v
 AMC next-best task
        |
        v
 intervention
        |
        v
 outcome
        |
        +------> PIE state update
```

## P0: Contract

Plugin identity is versioned as `AMC 1.0.0`.

The plugin versions its:
- contract
- blueprint
- taxonomy
- environment
- target definition

The plugin does not version or redefine PIE state mathematics.

## P1: Blueprint

### AMC CAT MCQ

The current AMC V8 specification describes:
- 150 MCQs
- 3.5 hours
- computer adaptive delivery
- one correct response from five options
- Adult Medicine 30%
- Adult Surgery 20%
- Women's Health 12.5%
- Child Health 12.5%
- Mental Health 12.5%
- Population Health 12.5%

These are exam metadata, not PIE candidate-state weights.

### AMC Clinical

The current AMC clinical examination page describes:
- 16 assessed stations
- 4 rest stations
- 10 minutes per station
- 2 minutes reading
- 8 minutes assessment
- predominant areas:
  - history
  - examination
  - diagnostic formulation
  - management/counselling/education

## P2: Question/task intelligence

AMC context is stored separately from statistical question state.

Examples:
- patient group
- clinical domain
- task type
- cognitive demand
- question family
- novelty
- AMC relevance
- source evidence level

PIE remains the owner of:
- difficulty posterior
- discrimination posterior
- ambiguity evidence
- question uncertainty
- candidate-question joint inference

## P3: Environment

AMC environments are versioned.

The environment contains:
- blueprint
- timing
- task mix
- difficulty distribution
- target definition
- source manifest

No fixed PIE weights are stored in the environment.

## P4: Readiness adapter

Readiness is conditional:

`Core candidate state + AMC environment -> AMC-specific readiness`

The output includes:
- target probability
- uncertainty
- evidence
- identification status
- readiness status
- model version

It is not a permanent candidate trait.

## P5: Decision / DWIG

AMC Plugin v1 supplies AMC context to PIE DWIG.

DWIG selects the next observation or task by expected reduction in decision uncertainty.

The plugin does not create a second competing DWIG formula.

## P6: Intervention catalogue

AMC interventions are definitions, not proven effects.

Each intervention records:
- target state
- exam mode
- delivery type
- measurable outcome

Initial state:
- evidence level = `UNVALIDATED`
- active = `false`

An intervention can become active only after the PIE validation and certification process supports it.

## Security boundary

### Candidate may receive

- sanitized AMC blueprint information
- exam mode
- safe readiness summary when certified and allowed
- safe next-action type/reference

### Candidate must never receive directly

- raw PIE candidate state
- state uncertainty distributions
- question posterior parameters
- question quarantine state
- hidden hypotheses
- DWIG candidate/evaluation rows
- causal effect estimates
- intervention effectiveness estimates
- certification gates
- another candidate's data
- service-role credentials

### Access path

```
Browser
  |
  | authenticated request
  v
AMC Edge Function
  |
  | service_role
  v
AMC + PIE internal tables
  |
  v
allow-listed DTO
  |
  v
Browser
```

The database therefore has two boundaries:

1. PostgreSQL/RLS blocks direct candidate access.
2. The Edge Function controls the information released to the candidate.

## Source provenance

AMC-specific facts are stored with source provenance. Current v1 sources:
- AMC MCQ Examination Specifications V8
- AMC Clinical Examination page
- AMC Assessment Domains

The plugin must be re-versioned if AMC changes examination specifications.

## Non-goals for v1

- No final readiness formula.
- No fixed weights for PIE dimensions.
- No causal claim that an intervention improves AMC performance.
- No automatic promotion to ACTIVE.
- No candidate-visible raw intelligence.

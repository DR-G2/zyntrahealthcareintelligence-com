# P11 Production Certification

Date: 2026-10-08

## Result

**PIE LIVE CERTIFICATION: PASS 37 / FAIL 0**

GitHub Actions run: `37747263939`

The certification executed against the live V2 Supabase environment using two distinct authenticated certification identities.

## Certified contracts

### P0
- practice question payload contains no answer key;
- explanation is null/absent from the learner payload;
- server controls the question boundary.

### P1/P2
- authoritative attempt persistence;
- server-derived correctness;
- server-derived answer-change count;
- learner state persistence;
- uncertainty/confidence signal;
- model/state provenance.

### P3/P4
- learner state rebuild path;
- learner-safe state boundary;
- internal raw PIE tables are not directly readable by learners.

### P5
- adaptive session created server-side;
- questions selected server-side;
- next question does not accept a client-supplied question ID.

### P6
- adaptive decision path remains server controlled.

### P7
- beta gate rejects unauthorized candidate B;
- adaptive session path works for the authorized certification candidate.

### P8
- authoritative inference endpoint returns six dimensions;
- uncertainty and `pie-inference-v2.0` provenance are present;
- dimensions: capability, decision, timing, calibration, sustained_performance, learning.

### P9
- raw PIE observation access denied;
- learner cannot self-submit raw PIE observations;
- security capture policy is learner-safe;
- capture scope is Zyntra viewport only;
- full-device capture is disabled.

### P10
- AMC readiness endpoint is live;
- AMC environment is versioned;
- raw AMC evaluation table is protected;
- pass probability remains null while empirical calibration is absent;
- `NOT_CALIBRATED` fail-closed behaviour is verified.

### Cross-user isolation
- B cannot read A's learner-safe state;
- B cannot read A's raw observations;
- B cannot rebuild A;
- learner-scoped state endpoint returns only the authenticated learner.

### Session lifecycle
- practice session completes successfully after certification attempt.

## Security database state at certification

- open high/critical incidents: 0
- active security restrictions: 0
- raw security SELECT grants to anon/authenticated: 0
- active calibrated AMC pass-probability models: 0
- promoted AMC validation runs: 0

Four historical P9.7 synthetic high-severity test events remain without evidence hashes. They are legacy certification artifacts, not open incidents or active restrictions. They are not treated as live learner security events.

## Important non-claims

P11 certifies the implemented production contracts above. It does **not** certify:
- AMC pass-probability accuracy;
- AMC proprietary scoring equivalence;
- external psychometric validity;
- clinical safety of generated medical advice;
- successful external email delivery where provider secrets/webhooks have not been configured;
- browser-level screenshot capture E2E beyond the live API/storage controls.

Those remain separately gated.

## Final interpretation

P11 is a successful engineering/production certification of the current PIE + AMC adapter + security boundary.

AMC calibrated pass-probability activation remains fail-closed until the P10 scientific validation gate is satisfied.

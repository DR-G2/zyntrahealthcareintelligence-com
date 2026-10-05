# PIE P4: Question Intelligence and Joint Candidate-Question Inference

P4 adds the question side of PIE.

## Question state

A question version has its own inferred state:

- difficulty
- discrimination
- ambiguity
- novelty

Each parameter has:

**estimate + uncertainty + evidence quality**

Question metadata and inferred statistical behaviour remain separate.

## Candidate-question model

P4 provides:

P(correct | candidate state, question state)

The prediction is joint, but the candidate and question contributions remain separately inspectable.

## Anti-circularity

P4 does not allow one candidate's observation to validate a question parameter.

A question starts protected. It requires cross-candidate replication before it can affect the question model.

Question evidence is kept separate from candidate evidence.

## Leave-one-question-out

For candidate evaluation, P4 provides a leave-one-question-out prediction path:

Z_u^(-q) -> P(Y_uq | Z_u^(-q), Q_q)

This prevents the observed response to q from fully defining the candidate state used to judge q.

## Question protection

If question uncertainty or ambiguity is high, the question can be quarantined.

Principle:

> Uncertain question behaviour must reduce confidence in the question before it reduces confidence in the candidate.

## Question versions

Historical attempts retain question version identity. A new question version is a separate statistical object.

## Evidence hierarchy

P4 recognises:

1. expert metadata
2. initial production
3. observed psychometric evidence
4. cross-candidate replication
5. validated behaviour
6. stable production

The implementation does not claim that raw attempt count alone proves a level.

## Safety

P4 does not:

- change candidate readiness
- promote a question automatically
- delete legacy question data
- expose statistical question internals to candidates
- make causal claims

P4 is a development inference layer until validation certifies the mathematics.

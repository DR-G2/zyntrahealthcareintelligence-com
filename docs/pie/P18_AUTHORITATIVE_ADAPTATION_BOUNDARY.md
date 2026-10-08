# P18 Authoritative Adaptation Boundary

P18 certifies the existing server-authoritative PIE adaptive selector as the production adaptation boundary.

## Boundary

Authoritative adaptation is performed server-side by the existing PIE selector and its versioned selection policy. The browser supplies session intent, not question IDs or ranking decisions.

The selector records a decision trace for each adaptive decision and returns only the server-selected question metadata needed by Practice.

## Critical separation

The P12 `pie-inference-v2.1-shadow` output remains shadow-only. P18 does not make P12 shadow inference authoritative and does not feed `pie.inference_shadow` into the adaptive selector.

## Acceptance

- P18 authoritative adaptation certification passes.
- Server-created adaptive session passes.
- No answer key/explanation is exposed before answering.
- Answer persistence remains server-authoritative.
- Next-question selection is server-authoritative.
- Decision identifier and NBLE decision type are returned.
- Cross-user session access is denied.
- Decision trace is protected from browser reads.
- Client contains no question-selection algorithm or client-supplied question IDs.
- Versioned selection policy and decision trace are present.
- P17 6/6 certification passes.
- P16 12/12 regression passes.
- P15 13/13 regression passes.
- P14 14/14 regression passes.
- P13 10/10 regression passes.
- P12 13/13 regression passes.

P18 does not introduce a second scoring engine and does not modify the certified P12-P17 inference/read/failure-isolation contracts.

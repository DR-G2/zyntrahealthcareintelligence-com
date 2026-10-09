# P17 Failure Isolation

P17 proves that authoritative practice persistence is independent from optional PIE/intelligence persistence.

## Production invariant

public.save_attempt writes the authoritative attempt first. Intelligence and PIE observation writes are isolated exception blocks. A PIE failure must not roll back or block the authoritative attempt.

## Live fault-injection proof

A transaction-scoped trigger intentionally failed the pie.pie_observation insert during an authenticated public.save_attempt call.

Observed:
- authoritative attempt persisted: **1**
- PIE observation persisted for that attempt: **0**
- temporary fault-injection trigger remaining after cleanup: **0**

The trigger and helper function were removed in the same transaction.

## Acceptance

- P17 failure-isolation certification passes.
- Unit tests pass.
- Typecheck passes.
- Production build passes.
- P16 12/12 regression passes.
- P15 13/13 regression passes.
- P14 14/14 regression passes.
- P13 10/10 regression passes.
- P12 13/13 regression passes.

P12 through P16 remain unchanged. P17 introduces no authoritative adaptation.

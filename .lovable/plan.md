

## Plan: Replace Placeholder Razorpay Plan IDs

Update `src/lib/razorpay-config.ts` with the actual plan IDs:

| Tier | Plan ID |
|------|---------|
| MCQ Only Monthly | `plan_SOsMQofBcfw3BU` |
| MCQ Only 3-Month | `plan_SOsNlReb9DLlAw` |
| OSCE Only Monthly | `plan_SOsOO6jO9w1WOH` |
| OSCE Only 3-Month | `plan_SOsOwdvVugEsde` |
| Full Access Monthly | `plan_SOsQDhBQkgyFfr` |
| Full Access 3-Month | `plan_SOsR9Hjy6UHpNG` |

Replace all placeholder values in both `RAZORPAY_TIERS` and `PLAN_TIER_MAP` objects in the single file `src/lib/razorpay-config.ts`.


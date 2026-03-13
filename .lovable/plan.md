

## Plan: Phase 4 (Admin Tracking) & Phase 5 (Security Hardening)

### Phase 4: Admin Tracking

**4a. Expand `admin-inspect-user` edge function** to include subscription data alongside the existing profile/stats response:

- Query `manual_overrides` and `payments` tables for the inspected user
- Add to response: `subscription: { status, tier, subscription_end, days_remaining }`
- Profile already returns `exam_target`, `amc1_score`, `amc2_booking_status`, `exam_location` since those columns exist on `profiles` and the function does `select("*")`

**4b. Update `UserInspectionPanel.tsx`** Profile tab to display the new fields:

- Add rows: Exam Target, AMC1 Score, AMC2 Booking, Exam Location
- Add a "Subscription" section showing: Tier badge, Status, Expiry date, Days remaining (with amber styling if ≤ 3 days)

No database changes needed — all data already exists in tables.

---

### Phase 5: Security Hardening

**5a. Obfuscate cached OSCE station payload** in `osce-cache.ts`:

- Add `encodePayload(station)` / `decodePayload(data)` using base64 + simple XOR scramble before storing in IndexedDB
- Prevents casual inspection via DevTools → Application → IndexedDB

**5b. Auto-replace expired stations** in `osce-cache.ts`:

- Add `STATION_TTL = 24 * 60 * 60 * 1000` (24 hours)
- `getCachedStations()` filters out expired entries and deletes them
- `useOSCEPreload` already backfills when cache < target size

**5c. Enhance `SecurityOverlay.tsx`** for OSCE content:

- Add CSS to prevent printing (`@media print { body { display: none } }`)
- Block `Ctrl+Shift+4` / `Cmd+Shift+4` (macOS screenshot shortcut)

---

### Summary

| File | Change |
|------|--------|
| `supabase/functions/admin-inspect-user/index.ts` | Add subscription data queries |
| `src/components/admin/UserInspectionPanel.tsx` | Show exam target, AMC score, subscription status |
| `src/lib/osce-cache.ts` | Add payload obfuscation + TTL auto-expiry |
| `src/hooks/useOSCEPreload.ts` | No changes needed (already handles backfill) |
| `src/components/SecurityOverlay.tsx` | Add print blocking + extra screenshot key combos |


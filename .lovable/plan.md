

## Plan: Platform Stabilization and Mandatory Profile Completion

### 1. Mandatory Profile Completion Modal

**Problem:** Users can access the platform with incomplete profiles (missing country, medical college, graduation year, etc.).

**Solution:** Add a profile completeness check in `ProtectedRoute.tsx`. After terms acceptance, check if required fields are filled. If not, show a modal.

**File: `src/components/ProfileCompletionModal.tsx`** (New)
- Dialog with fields: Full Name, Country, Medical Degree (user_type), University (medical_college), Graduation Year, AMC Candidate ID (optional → new column `amc_candidate_id` on profiles)
- Pre-fill from existing profile data
- On submit, update `profiles` table and refresh profile
- Cannot be dismissed without completing required fields

**File: `src/components/ProtectedRoute.tsx`**
- After terms check passes, add a profile completeness check:
  ```
  const isProfileComplete = profile?.name && profile?.country_of_origin && 
    profile?.user_type && profile?.medical_college && profile?.graduation_year;
  ```
- If incomplete, render `<ProfileCompletionModal>` instead of children

**Database migration:** Add `amc_candidate_id text` column to profiles.

---

### 2. Terms & Conditions Bug Fix

**Problem:** Terms popup reappears every ~20 minutes because `fetchTermsAcceptance` is re-called on every auth state change (which fires on token refresh every ~20 min).

**Root cause:** In `AuthContext.tsx`, `onAuthStateChange` fires for `TOKEN_REFRESHED` events, which re-runs `fetchTermsAcceptance`. But the real issue is the terms check uses `user_legal_acceptance` table which works correctly — the bug is likely that `termsAccepted` state resets to `false` temporarily during auth state changes.

**Fix in `src/contexts/AuthContext.tsx`:**
- Cache `termsAccepted` in a ref so it persists across re-renders
- In `onAuthStateChange`, skip re-fetching terms if already accepted: `if (!termsAccepted) fetchTermsAcceptance()`
- Similarly skip profile/watermark re-fetch on `TOKEN_REFRESHED` events — only re-fetch on `SIGNED_IN`

---

### 3. Session Stability Fixes

**Problem:** Lag and unexpected logouts from redundant API calls and auth state loops.

**Fixes in `src/contexts/AuthContext.tsx`:**
- Check `_event` type in `onAuthStateChange` — only run full fetch chain on `SIGNED_IN` and `INITIAL_SESSION`, not on `TOKEN_REFRESHED`
- Reduce subscription polling from 60s to 5 minutes (300s)
- Add a guard to prevent duplicate fetches (use a ref flag `isFetching`)

**Fixes in `src/hooks/usePresence.ts`:**
- Reduce heartbeat from 30s to 60s to cut API calls in half

---

### 4. OSCE Loading Reliability

**File: `src/pages/Stations.tsx`**

- Add 30-second timeout with auto-retry (max 3 attempts)
- Show progressive loading messages: "Preparing your OSCE station..." → "Taking longer than expected. Retrying..." → "Unable to load station."
- Wrap evaluation in async flow: on eval failure after submit, save data locally and show "Evaluation in progress" instead of reverting to station phase

**Implementation:**
```typescript
const startStation = async (subject: string, attempt = 1) => {
  setPhase('loading');
  setLoadingMessage('Preparing your OSCE station...');
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-station', {
      body: { subject, mode },
    });
    clearTimeout(timeout);
    if (error) throw error;
    // ... setup station
  } catch (err) {
    clearTimeout(timeout);
    if (attempt < 3) {
      setLoadingMessage('Station loading is taking longer than expected. Retrying...');
      return startStation(subject, attempt + 1);
    }
    setLoadingMessage('Unable to load station. Please refresh or contact support.');
    // show retry button
  }
};
```

---

### 5. Error Logging Table

**Database migration:**
```sql
CREATE TABLE public.system_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type text NOT NULL,
  user_email text,
  user_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
```

No RLS policies (service role only). Log errors from edge functions.

**File: `supabase/functions/generate-station/index.ts`** — Add error logging on failure
**File: `supabase/functions/evaluate-station/index.ts`** — Add error logging on failure

---

### Files Changed Summary

| File | Change |
|------|--------|
| Database migration | Add `amc_candidate_id` to profiles, create `system_error_logs` |
| `src/components/ProfileCompletionModal.tsx` | **New** — mandatory profile form |
| `src/components/ProtectedRoute.tsx` | Add profile completeness gate |
| `src/contexts/AuthContext.tsx` | Fix terms re-check bug, reduce polling, handle auth events properly |
| `src/hooks/usePresence.ts` | Reduce heartbeat frequency |
| `src/pages/Stations.tsx` | Add timeout/retry, progressive loading, async evaluation |
| `supabase/functions/generate-station/index.ts` | Add error logging |
| `supabase/functions/evaluate-station/index.ts` | Add error logging |


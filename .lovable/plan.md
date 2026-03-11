

## Plan: Fix system-health-check Edge Function

### Problem
The edge function references `runCheck()` helper and `StepResult` type that were never defined in the file, causing a runtime `ReferenceError`.

### Fix
Add the missing `StepResult` interface and `runCheck` helper function before the `serve()` call.

**File:** `supabase/functions/system-health-check/index.ts`

Add before line 9:

```typescript
interface StepResult {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  error?: string;
  details?: Record<string, unknown>;
}

async function runCheck(
  name: string,
  fn: () => Promise<Record<string, unknown>>
): Promise<StepResult> {
  const start = Date.now();
  try {
    const details = await fn();
    const latency = Date.now() - start;
    return {
      name,
      status: latency > 2000 ? "degraded" : "healthy",
      latency_ms: latency,
      details,
    };
  } catch (e) {
    return {
      name,
      status: "down",
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
```

No other files need changes. This is a single-file fix.


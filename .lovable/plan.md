

## Plan: Student Simulation Diagnostic Test

Add a "Student Simulation" feature to the system monitor that simulates a real user flow end-to-end and reports pass/fail for each step.

### 1. Edge Function: `system-health-check`

**New file:** `supabase/functions/system-health-check/index.ts`

A single endpoint that performs two modes:
- **`standard`**: Quick checks (DB ping, load 1 question, load 1 station)
- **`simulation`**: Full student simulation flow

**Student Simulation Steps** (each wrapped in try/catch, timed):

| Step | Check | Method |
|------|-------|--------|
| 1. Database | `SELECT 1` | Service role client query |
| 2. Auth | Validate caller's JWT | Token verification |
| 3. Load MCQ | Fetch 1 random question from `questions` | `.from('questions').select().limit(1)` |
| 4. Validate MCQ | Check question has `correct_answer`, `options` | Field presence check |
| 5. Load OSCE | Fetch 1 random station from `clinical_stations` | `.from('clinical_stations').select().limit(1)` |
| 6. Validate OSCE | Check station has `scenario_data` | Field presence check |
| 7. AI Service | Ping `retrain-ai-context` with `{ health_check: true }` | Function invoke |
| 8. Payments | Query latest row from `payments` | `.from('payments').select().limit(1)` |

Returns per-step status, latency, and error message if failed. Overall status: all pass = healthy, any slow (>2s) = degraded, any fail = down.

### 2. Database: `system_health_logs` Table

```sql
CREATE TABLE public.system_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  overall_status text NOT NULL DEFAULT 'healthy',
  mode text NOT NULL DEFAULT 'standard',
  steps jsonb NOT NULL DEFAULT '[]',
  total_latency_ms integer NOT NULL DEFAULT 0
);
-- No RLS needed — only service role writes, admin reads via edge function
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;
```

### 3. Admin UI: `SystemMonitorTab.tsx`

**New file:** `src/components/admin/SystemMonitorTab.tsx`

Add as a new tab ("System") in `AdminDashboard.tsx`.

Sections:
- **Status Cards** — One card per service (DB, Auth, MCQ, OSCE, AI, Payments) with green/yellow/red dot
- **Run Simulation** button — Calls edge function with `mode: 'simulation'`, shows step-by-step results in a timeline view with latency per step
- **Health History** — Recharts line chart of latency from `system_health_logs` (last 24h)
- **Recent Failures** — Table of non-healthy log entries
- **Auto-Refresh** toggle — Polls every 60s

### 4. Config & Routing

- Register `system-health-check` in `supabase/config.toml`
- Add "System" tab to `AdminDashboard.tsx` tabs grid

### Files Changed

| File | Change |
|------|--------|
| Database migration | Create `system_health_logs` table |
| `supabase/functions/system-health-check/index.ts` | New edge function with simulation |
| `supabase/config.toml` | Register function |
| `src/components/admin/SystemMonitorTab.tsx` | New admin tab component |
| `src/pages/AdminDashboard.tsx` | Add "System" tab |


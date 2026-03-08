

## Plan: Real-Time Active Users Dashboard + Auto AI Retraining

### 1. Real-Time Presence & Progress Dashboard (Admin Tab)

**Database changes:**
- New `user_presence` table: `user_id`, `last_seen_at`, `current_page`, `is_online` (with realtime enabled)
- Add trigger to auto-set `is_online = false` after 5 min inactivity

**Frontend — presence tracking (`src/hooks/usePresence.ts`):**
- On mount and every 30s, upsert into `user_presence` with current route and timestamp
- On unmount/tab close, mark offline

**Admin Dashboard — new "Live Activity" tab:**
- Subscribe to `user_presence` via Supabase Realtime
- Show each online user with: green dot, name/email, current page, and inline stats (questions today, accuracy, streak, time spent)
- Stats fetched by a new edge function `admin-live-stats` that aggregates `user_attempts`, `station_attempts`, and `user_progress` for all online users in one call

### 2. Auto AI Retraining (Scheduled Edge Function)

**New edge function `retrain-ai-context/index.ts`:**
- Aggregates all candidate data: overall accuracy distribution, per-category pass rates, common trap flags, archetype distribution, average OSCE scores, first-instinct accuracy stats
- Stores the aggregated context in a new `ai_training_context` table (single row, upserted)
- This context is then read by existing AI edge functions (`generate-questions`, `analyze-behavior`, `generate-study-plan`, `evaluate-station`) to enrich their system prompts with real population data

**New `ai_training_context` table:**
- `id` (uuid), `aggregate_data` (jsonb), `candidate_count` (int), `updated_at` (timestamptz)

**Cron schedule:** Run `retrain-ai-context` daily via `pg_cron`

**AI prompt integration:** Each AI edge function reads the latest row from `ai_training_context` and appends population-level stats to its system prompt (e.g., "Based on 500 candidates, average accuracy is 62%, top trap is second_guessing_success at 34%")

### 3. Files Changed

| File | Change |
|------|--------|
| New: `src/hooks/usePresence.ts` | Heartbeat presence tracker |
| New: `src/components/admin/LiveActivityTab.tsx` | Real-time active users + progress cards |
| New: `supabase/functions/admin-live-stats/index.ts` | Aggregate stats for online users |
| New: `supabase/functions/retrain-ai-context/index.ts` | Aggregate all candidate data for AI |
| Edit: `src/pages/AdminDashboard.tsx` | Add "Live Activity" tab |
| Edit: `supabase/functions/generate-questions/index.ts` | Read training context |
| Edit: `supabase/functions/analyze-behavior/index.ts` | Read training context |
| Edit: `supabase/functions/generate-study-plan/index.ts` | Read training context |
| Edit: `supabase/functions/evaluate-station/index.ts` | Read training context |
| Edit: `supabase/config.toml` | Add new functions |
| Migration: 2 new tables (`user_presence`, `ai_training_context`) + RLS + realtime |
| Insert: `pg_cron` schedule for daily retrain |


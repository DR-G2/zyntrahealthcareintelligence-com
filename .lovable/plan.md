

## Plan: AI Feature Builder System

### Overview
Create an admin-only AI Feature Builder at `/admin/ai-builder` (super_admin only) that accepts natural language feature descriptions, generates structured implementation plans via Lovable AI, and stores request history.

**Important caveat:** This system generates plans and code suggestions for review — it cannot directly modify production code. Code patches are displayed as diffs for manual implementation.

---

### 1. Database Migration

**New table: `ai_feature_requests`**
```sql
CREATE TABLE public.ai_feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  plan jsonb DEFAULT '{}',
  generated_code jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_feature_requests ENABLE ROW LEVEL SECURITY;
```

**New table: `ai_patch_logs`**
```sql
CREATE TABLE public.ai_patch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_request_id uuid REFERENCES public.ai_feature_requests(id),
  files_modified jsonb DEFAULT '[]',
  changes jsonb DEFAULT '{}',
  approved_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_patch_logs ENABLE ROW LEVEL SECURITY;
```

No RLS policies (service role only via edge functions).

---

### 2. New Edge Function: `ai-feature-builder`

**File:** `supabase/functions/ai-feature-builder/index.ts`

- Validates caller is super_admin via `admin_roles` table
- Accepts `{ prompt }` body
- Calls Lovable AI (`google/gemini-2.5-pro`) with a system prompt that instructs the model to return structured output via tool calling:
  - `affected_modules` (array of strings)
  - `database_changes` (SQL migrations)
  - `api_changes` (edge function code)
  - `ui_changes` (React component code)
  - `steps` (ordered implementation plan)
- Saves the request + plan to `ai_feature_requests`
- Returns the structured plan

Second action `approve`:
- Updates status to `approved`
- Logs to `ai_patch_logs`

---

### 3. New Page: `src/pages/AIFeatureBuilder.tsx`

Super-admin-only page with:

1. **Prompt input** — textarea for natural language feature description
2. **Generate button** — calls edge function, shows loading state
3. **Plan display** — renders structured steps with affected modules, DB changes, API changes, UI changes
4. **Code preview** — syntax-highlighted code blocks for each generated file/patch
5. **Approve button** — marks the request as approved and logs the patch
6. **History section** — table of past feature requests with status badges (pending/approved/rejected)

---

### 4. Routing & Navigation

- Add route `/admin/ai-builder` in `App.tsx` (lazy loaded, protected)
- Add sidebar link under Admin section (super_admin only) in `AppSidebar.tsx`

---

### Files Changed Summary

| File | Change |
|------|--------|
| Database migration | `ai_feature_requests`, `ai_patch_logs` tables |
| `supabase/functions/ai-feature-builder/index.ts` | **New** — AI plan generation + approval |
| `src/pages/AIFeatureBuilder.tsx` | **New** — admin UI for feature builder |
| `src/App.tsx` | Add route |
| `src/components/AppSidebar.tsx` | Add nav link for super_admin |


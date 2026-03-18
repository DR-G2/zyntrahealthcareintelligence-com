

## Plan: Centralized QNS System with MCQ TEMP Toggle

### Overview
Introduce a parent "QNS" tab in the Admin Dashboard containing sub-tabs (MCQ, MCQ TEMP, OSCE, ALL QNS). Add a `question_type` column to the `questions` table. Replace the existing top-level MCQ/OSCE tabs with the unified QNS tab. Remove Quality Audit UI. Add `mcq_temp_enabled` site setting.

### Database Changes

**Migration: Add `question_type` column + `mcq_temp_enabled` setting**

```sql
-- Add question_type to questions table (default 'mcq' for existing rows)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'mcq';

-- Update zyntra_id trigger to use QN- prefix for universal IDs
CREATE OR REPLACE FUNCTION public.assign_zyntra_id_question()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE max_num integer;
BEGIN
  IF NEW.zyntra_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(zyntra_id FROM '(\d+)$') AS integer)), 0)
    INTO max_num FROM public.questions WHERE zyntra_id IS NOT NULL;
    NEW.zyntra_id := 'QN-' || LPAD((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
```

**Data insert: seed `mcq_temp_enabled` setting**
```sql
INSERT INTO site_settings (key, value) VALUES ('mcq_temp_enabled', 'false') ON CONFLICT (key) DO NOTHING;
```

### File Changes

| File | Action |
|------|--------|
| Migration SQL | Add `question_type` column, update zyntra_id trigger |
| `site_settings` | Insert `mcq_temp_enabled = false` |
| `src/pages/AdminDashboard.tsx` | Major refactor — see below |
| `src/hooks/useSiteSettings.ts` | Add `useMCQTempEnabled` hook |
| `supabase/functions/admin-manage-questions/index.ts` | Support `question_type` field in list/create/update |
| `src/components/admin/MCQEditor.tsx` | Accept `questionType` prop |

### AdminDashboard Refactor

1. **Remove** the top-level `mcq` and `osce` tabs from the main tab bar
2. **Add** a `qns` tab to the main tab bar
3. **Remove** Quality Audit card + dialog + `runAudit` function + `auditResult`/`auditOpen` state
4. **Add** `mcq_temp_enabled` to `SITE_SETTINGS_CONFIG`

**QNS tab structure** (nested tabs inside TabsContent):
```
QNS
├── MCQ         → Create-only MCQEditor (question_type='mcq')
├── MCQ TEMP    → Create-only MCQEditor (question_type='mcq_temp')  
├── OSCE        → Existing OSCE create interface (stripped of edit/delete)
└── ALL QNS     → Master table showing ALL questions with full edit/delete/type-change
```

- **MCQ / MCQ TEMP sub-tabs**: Show only the `MCQEditor` component in create mode + import JSON. No question bank table.
- **OSCE sub-tab**: Show only the OSCE generation/import interface. No station list/edit.
- **ALL QNS sub-tab**: Full question bank table (MCQ + MCQ TEMP merged from `questions` table), plus OSCE stations. Filter by type. Full edit/delete/duplicate/type-change capabilities. The existing question bank table + OSCE station table consolidated here.

### MCQ TEMP Toggle Logic

- Add to `SITE_SETTINGS_CONFIG`: `{ key: 'mcq_temp_enabled', label: 'Enable MCQ TEMP', description: 'Include MCQ TEMP questions in user-facing practice modes', defaultValue: false }`
- Add `useMCQTempEnabled` hook in `useSiteSettings.ts`
- In practice/learn pages where questions are fetched, filter out `question_type = 'mcq_temp'` when the setting is disabled (this is done at query time — the existing question fetch already goes through the `questions` table)

### Unique ID System

The existing `assign_zyntra_id_question` trigger already auto-assigns IDs. We update it to use `QN-XXXX` format instead of `ZYNTRA-MCQ-XXXXX` for universal coverage across MCQ/MCQ TEMP/OSCE types. The ID is immutable and auto-generated.

### Quality Audit Removal

- Remove `runAudit`, `auditResult`, `auditOpen`, `auditRunning` state from `AdminDashboard`
- Remove the Quality Audit Card (lines ~1497-1507)
- Remove the Quality Audit Dialog (lines ~1401-1492)
- The `admin-audit-quality` edge function file remains but is no longer called from UI

### What Stays the Same

- Users tab, Messages tab, Strikes tab, Screenshots tab, AI Core, System, Logs — all untouched
- Full Cleanup card stays
- Site Settings card stays (gains new toggle)
- Admins Online panel stays
- All existing RLS policies unchanged


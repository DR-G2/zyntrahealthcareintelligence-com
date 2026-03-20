

## Plan: Reset Subjects + Add Structured Subtopics

### Overview
Delete all existing subjects, re-insert the 6 required subjects, create a new `subtopics` table linked to subjects, seed subtopics for each subject, and update the MCQ editor to use a dropdown for subtopics filtered by selected subject.

### Database Changes

**Migration: Create `subtopics` table**
```sql
CREATE TABLE public.subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read subtopics" ON public.subtopics FOR SELECT TO authenticated USING (true);
```

**Data operations (via insert tool):**
1. Delete all from `subjects` (cascades to subtopics)
2. Insert 6 subjects: Medicine, Surgery, Acute Medicine, OB&G, Population Health, Basic Science
3. Insert subtopics per subject:

| Medicine | Surgery | Acute Medicine | OB&G | Population Health | Basic Science |
|----------|---------|----------------|------|-------------------|---------------|
| Cardiology | Upper GI | Emergency Medicine | Obstetrics | Epidemiology | Anatomy |
| Respiratory | Lower GI / Colorectal | Toxicology | Gynaecology | Biostatistics | Physiology |
| Gastroenterology | Hepatobiliary | Trauma | Antenatal Care | Preventive Medicine | Biochemistry |
| Neurology | Breast & Endocrine | Resuscitation | Postnatal Care | Public Health | Pathology |
| Endocrinology | Vascular | Critical Care | Reproductive Medicine | Ethics & Law | Pharmacology |
| Nephrology | Urology | Acute Coronary Syndromes | Family Planning | Health Systems | Microbiology |
| Haematology | Orthopaedics | Acute Abdomen | Menopause | Research Methods | Genetics |
| Rheumatology | Neurosurgery | Stroke | Urogynaecology | Cultural Safety | Immunology |
| Infectious Disease | Cardiothoracic | Sepsis | Breast Disease | Indigenous Health | Embryology |
| Dermatology | Plastic & Reconstructive | Anaphylaxis | Oncology | Global Health | Histology |
| Psychiatry | Paediatric Surgery | Burns | Maternal Medicine | | |
| Geriatrics | Transplant Surgery | Envenomation | | | |
| Palliative Care | | Overdose | | | |
| Oncology | | Environmental Emergencies | | | |
| Ophthalmology | | | | | |
| ENT | | | | | |
| Paediatrics | | | | | |

### Code Changes

**1. `supabase/functions/admin-manage-questions/index.ts`**
- Add `subtopic` management actions: `list_subtopics` (by subject_id or all), `add_subtopic`, `rename_subtopic`, `delete_subtopic`

**2. `src/components/admin/MCQEditor.tsx`**
- Replace free-text `Subtopic` input with a `<Select>` dropdown
- Fetch subtopics from the edge function, filter by selected `category` (subject)
- When subject changes, reset subtopic selection
- Keep an "Other" option that allows free-text input as fallback

**3. `src/components/admin/QNSTab.tsx`**
- Update `CATEGORIES` to match exact 6 subjects
- Update ALL QNS edit dialog to use subtopic dropdown

### What Stays the Same
- `questions.subtopic` remains a text column (stores the subtopic name)
- All existing RLS policies unchanged
- Import JSON still accepts `subtopic` as text (matched against subtopic names)


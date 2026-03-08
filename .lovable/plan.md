

## Plan: Clean Question Database and Normalize Categories

### Current State

| Metric | Count |
|--------|-------|
| Total questions | 4,014 |
| Garbage (generic identical options) | 2,800 |
| Template duplicates (boilerplate vignettes) | 600 |
| Legitimate unique questions | ~614 |

**3,400 questions (85%) are junk** — they share identical generic answer options or templated vignette text with no real clinical specificity.

Additionally, the 614 good questions use **48+ inconsistent category names** (e.g., "Cardiovascular" vs "Cardiology", "Mental Health" vs "Psychiatry", "Orthopaedics" vs "Orthopedics") that don't map to the `SYSTEMS` defined in `filter-data.ts`, breaking system/subject filtering.

### Plan

#### 1. Create a cleanup edge function (`admin-cleanup-questions`)

A new admin-only edge function that:
- **Deletes all garbage questions** where options contain the generic template text ("Initiate immediate empiric treatment targeting the suspected pathology")
- **Deletes all template-vignette duplicates** ("A patient presents with a clinical scenario frequently reported in AMC examination recalls")
- **Deduplicates** remaining questions (keeps one copy per `question_text`, deletes others)
- **Remaps categories** to match `SYSTEMS` from `filter-data.ts` using a mapping table:

```text
Current DB Category     →  Normalized System
─────────────────────────────────────────────
Cardiovascular          →  Cardiology
Respiratory Medicine    →  Respiratory
Gastrointestinal        →  Gastroenterology (already exists)  
Hematology              →  Haematology
Haematology/Oncology    →  Haematology
Mental Health           →  Psychiatry
Mood Disorders          →  Psychiatry
Psychosis               →  Psychiatry
Anxiety/OCD/PTSD        →  Psychiatry
Substance Use           →  Psychiatry
Organic/Psychogeriatric →  Psychiatry
Orthopaedics            →  Musculoskeletal
Orthopedics             →  Musculoskeletal
Trauma                  →  Emergency Medicine
General Surgery         →  Surgery (add to SYSTEMS)
Vascular Surgery        →  Surgery
Cardiothoracic Surgery  →  Surgery
Neurosurgery            →  Surgery
Neonatology             →  Paediatrics
Common Paediatric...    →  Paediatrics
Paediatric Emergencies  →  Paediatrics
Obstetrics              →  Obstetrics & Gynaecology
Gynaecology             →  Obstetrics & Gynaecology
Urology                 →  Renal
Infectious Diseases     →  Infectious Disease (match existing)
Ethics/Legal            →  Population Health
Epidemiology/Screening  →  Population Health
Indigenous Health       →  Population Health
Public Health/Palliative→  Population Health
```

- Cleans up related tables (`bookmarks`, `user_notes`, `user_attempts`, `question_difficulty_tiers`) for deleted question IDs
- Returns a summary of actions taken

#### 2. Add cleanup button to Admin Dashboard

Add a "Clean & Normalize Questions" button in the Questions tab of `AdminDashboard.tsx` that calls this edge function and shows results.

#### 3. Update `filter-data.ts` SYSTEMS list

Add "Surgery" to the `SYSTEMS` array and its corresponding subjects, since many good questions fall under surgical categories.

#### 4. Update admin CATEGORIES constant

Align the `CATEGORIES` array in `AdminDashboard.tsx` with the normalized system names so future question generation uses correct categories.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/admin-cleanup-questions/index.ts` | New edge function for bulk cleanup + category normalization |
| `src/pages/AdminDashboard.tsx` | Add cleanup button, update CATEGORIES |
| `src/lib/filter-data.ts` | Add "Surgery" to SYSTEMS with subjects |

### Expected Outcome

After cleanup: ~613 high-quality, uniquely categorized questions with normalized categories that map cleanly to the filter system. The question bank and practice engine filters will work correctly.


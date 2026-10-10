# QNS V2 PH-01: Screening Programs

Canonical source: `ph01_screening_upload.json`  
Generator: `build_ph01.py`  
Incremental migration: `supabase/migrations_v2/0081_qns_v2_ph01_draft_import.sql`

## Contract
- 28 questions, five options each, answer-key distribution A=6, B=6, C=6, D=5, E=5.
- Source IDs PH-S-01 through PH-S-28; canonical QBank IDs ZQ-0401 through ZQ-0428.
- Stable UUID5 question and option identifiers; PIE concept, learning-objective, question-to-LO and AMC blueprint mappings.
- Correct-answer explanations, A-E rationale, evidence links and review metadata preserved.
- **All questions remain `draft`. This migration does not activate them.**
- Independent clinical sign-off is pending. Reviewer attribution/date are recorded as requested metadata, not represented as completed independent certification.

## Rebuild and validate
Run from repository root:
```bash
python supabase/seed_v2/qns_v2_ph01/validate_ph01.py
python supabase/seed_v2/qns_v2_ph01/build_ph01.py
```

The generated migration is incremental and idempotent for inserts. Review the diff before applying it to any database.

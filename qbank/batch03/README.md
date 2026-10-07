# Zyntra QBank – Batch 03 (ZQ-0351 to ZQ-0400)

50 original AMC-style single-best-answer MCQs (draft, pending owner and clinician review). All items have `is_active: false`.

## Files
- `batch03.json`: house format (irt_b, irt_b_source, difficulty_tier, references, reviewer_notes).
- `batch03_upload.json`: app import format. Tag order is ZQ id, `zyntra_bank`, `batch03`, `level_<tier>`, `task_<task>`, `group_<group>`, `sys_<slug>`, `irtb_<b>`, `pending_owner_review`.
- `validation_output.txt`: validator results.

## Mix
- **Groups:** Adult Medicine 15, Adult Surgery 10, Women's Health 6, Child Health 7, Mental Health 6, Population Health & Ethics 6. The extra seat rotated to Adult Medicine and Child Health.
- **Clinician task:** Management 17, Data gathering 17, Data interpretation/synthesis 16.
- **Difficulty:** easy 10, moderate 25, difficult 15. Tiers: 2 = 10, 3 = 25, 4 = 12, 5 = 3.
- **irt_b:** author estimates on the logit scale. All are within their tier band (range −1.3 to +1.6).
- **Answer keys:** A–E, 10 each (seeded shuffle 351).

## Verification
- Every guideline-dependent key was checked on 2026-10-07 (IST) against the live primary source cited in `references`. Sources include ANZCOR, the Australian Immunisation Handbook, Australian STI Management Guidelines, hepcguidelines.org.au, RCH CPGs, Australian Prescriber, COPD-X, Queensland Health, Qld Poisons Information Centre, PCFA 2026 prostate guidelines, AFP, RANZCP INTEGRATE, the Epilim PI, KDIGO and WSES.
- 4 epidemiology calculation or concept items have no guideline dependency. These are noted in `reviewer_notes`.
- `flag_source_check`: none.
- No exact duplicate stems. The highest stem similarity against the 170 bank, batch01 and batch02 is 0.39. Concepts were screened against the 270 existing items.

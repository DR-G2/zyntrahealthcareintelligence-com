# Zyntra question bank – Batch 2 (ZQ-0301 to ZQ-0350)

Status: draft, pending owner review. All items are original. None are copied from eMedici, UWorld or AMC recalls.

## Files
- `batch02.json`: house format, with irt_b, irt_b_source=author_estimate, difficulty_tier, app_difficulty, references and flag_source_check.
- `batch02_upload.json`: app import format, using the same keys as `export/zyntra_mcq_upload_170_tagged.json`. The ZQ id is the first tag, and irt_b is stored as an `irtb_<value>` tag.

## Mix
- Groups: Adult Medicine 15, Adult Surgery 10, Women's Health 7, Child Health 6, Mental Health 6, Population Health & Ethics 6.
- Difficulty: 10 easy, 25 moderate, 15 difficult.
- Answer key spread: A, B, C, D and E each appear 10 times (shuffled with seed 301).

## Revision 2 (7 Oct 2026 IST)
- Task mix rebalanced to 17 management, 17 data gathering and 16 data interpretation. Changed: ZQ-0303, 0308, 0311, 0314, 0316, 0318, 0322, 0328 and 0343 to data gathering; ZQ-0301 and 0340 to data interpretation.
- All 26 flags re-checked. ZQ-0311, 0314, 0316, 0328 and 0348 were rewritten to verifiable topics. The rest were verified against the URLs cited. No flags remain. Each item's `reviewer_notes` records any non-Australian or paediatric source.

## Sources
Guideline-dependent keys were checked against live pages on 7 Oct 2026 (IST), and the URL actually read is cited in `guideline_reference`. Items marked `flag_source_check` are ones where no primary source could be read while writing. In those items, `reviewer_notes` explains why. These need clinician source checking before activation.

Validation output is in `validation_output.txt`.

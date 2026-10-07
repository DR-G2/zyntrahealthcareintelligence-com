# Zyntra question bank: Batch 1 (ZQ-0251 to ZQ-0300)

These are 50 original single-best-answer MCQs in the style of the AMC MCQ exam. They follow the AMC MCQ Spec V8 blueprint and are written for Australian practice. **Status: draft, pending owner review and clinician sign-off** (`is_active: false`).

| Group | n |
|---|---|
| Adult Medicine | 15 |
| Adult Surgery | 10 |
| Women's Health | 6 |
| Child Health | 6 |
| Mental Health | 6 |
| Population Health & Ethics | 7 |

- Clinician task: management 17, data gathering 17, data interpretation and synthesis 16.
- Difficulty: easy 10, moderate 25, difficult 15.
- Answer key: A–E, 10 each.

## Files
- `batch01.json` is the house (authoring) format. It is a list of objects, one per item.
- `batch01_upload.json` is the app import format. It has the same shape as `export/zyntra_mcq_upload_170_tagged.json`.

## House format fields (`batch01.json`)
| Field | Meaning |
|---|---|
| `id` / `external_ref` | ZQ id, e.g. `ZQ-0251` |
| `patient_group` | `adult_medicine`, `adult_surgery`, `womens_health`, `child_health`, `mental_health`, `population_health_ethics` |
| `clinician_task` | `data_gathering`, `data_interpretation_synthesis`, `management` |
| `system`, `subtopic` | Body system and the specific concept tested |
| `difficulty`, `difficulty_tier`, `author_tier` | Integer tier 1–5 (2 = easy, 3 = moderate, 4–5 = difficult) |
| `app_difficulty` | `easy`, `moderate` or `difficult` (the value used by the app) |
| `irt_b` | Item difficulty on an IRT logit scale. It is an author estimate (easy about −1.5 to −0.5, moderate about −0.5 to +0.8, difficult about +0.8 to +2.2). Higher means harder; 0 is a typical item for the target candidate. |
| `irt_b_source` | `author_estimate`, until the value is calibrated from real response data |
| `stem`, `lead_in` | The vignette and the question |
| `options` | Options A–E (object) |
| `correct_answer` / `correct_option` | Key letter |
| `explanation_correct` | Why the key is correct |
| `option_explanations` | Why each distractor is wrong (keyed by letter) |
| `key_learning_point` | One-line takeaway |
| `references` | A list of `{name, url}` |
| `flag_source_check` | `true` if a key fact still needs checking against the live guideline (see `reviewer_notes`) |
| `reviewer_notes`, `status`, `version`, `is_active`, `is_synthetic`, `approved_by`, `approved_on`, `tags`, `n_options` | Workflow metadata |

## Upload format (`batch01_upload.json`)
The fields are the same as the existing 170-item export: `zyntra_id`, `question_text` (stem + lead-in), `options` (array), `correct_answer`, `explanation` (house layout: correct answer, explanation, key learning point, references), `category`, `system_category`, `subtopic`, `difficulty`, `difficulty_tier`, `incorrect_answer_explanations`, `key_takeaways`, `guideline_reference`, `clinical_vignette` and `question_type`.

The import has no field for IRT difficulty, so `irt_b` is carried as a tag `irtb_<value>` (e.g. `irtb_+1.30`). The first tag is always the ZQ id. Other tags include `zyntra_bank`, `batch01`, `level_<tier>`, `task_*`, `group_*`, `sys_*`, `pending_owner_review` and, where it applies, `flag_source_check`.

## Sources
The items cite Australian guidance where possible: eTG, RCH clinical practice guidelines, Australian Immunisation Handbook, RANZCOG/state maternity guidelines, RANZCP, ASHM, the Stillbirth CRE, Cancer Council/NHMRC and EMST. Major international guidelines are cited where no Australian equivalent exists. No item is copied or adapted from commercial question banks or AMC recalls.

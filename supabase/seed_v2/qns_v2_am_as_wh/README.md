# QNS V2 AM / AS / WH draft import

Three migrations, all draft-only. Reviewed by Dr. Heisenberg.

| Migration | Subject | Items | Subtopics | LOs |
|---|---|---|---|---|
| 0091 | Adult Medicine | 540 | 19 | ~146 |
| 0092 | Adult Surgery | 315 | 10 | ~63 |
| 0093 | Women's Health | 189 | 9 | ~40 |

Each migration:
- Creates the subject if missing
- Creates subtopics if missing
- Inserts concepts, learning objectives, questions (status='draft'), and question_lo mappings
- Uses stable UUID5 IDs on the shared PIE namespace
- Does not activate any question

Apply as postgres to V2. Verify all rows have status='draft'.

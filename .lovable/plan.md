

## Plan: Purge All Questions/Stations + Seed 6 Subjects

### Database Operations (via insert tool)

1. **Delete all data** from these tables in order:
   - `question_difficulty_tiers`, `question_dna`, `bookmarks`, `user_notes`, `user_attempts` (dependent data)
   - `questions` (all MCQ/MCQ TEMP)
   - `clinical_stations` (all OSCE stations)
   - `station_attempts`, `station_bookmarks`, `station_notes` (OSCE dependent data)
   - `subjects` (clear existing subjects)

2. **Insert 6 subjects** with auto-ordered `display_order`:

| Order | Subject |
|-------|---------|
| 1 | Medicine |
| 2 | Surgery |
| 3 | OB&G |
| 4 | Acute Medicine |
| 5 | Population Health |
| 6 | Basic Science |

### Code Change

Update the hardcoded `CATEGORIES` and `OSCE_SUBJECTS` arrays in `src/components/admin/QNSTab.tsx` to match the new 6 subjects as fallback defaults.

### What Stays the Same
- All table schemas unchanged
- All RLS policies unchanged
- All edge functions unchanged
- Admin Dashboard structure unchanged


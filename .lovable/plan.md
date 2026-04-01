

## Plan: Synthetic Data Import + Full Mock Mode

### Task 1: Generate & Insert 100 Synthetic Users

Create and run a script that populates the database with 100 realistic medical student profiles and their learning footprints.

**Data generated per user:**
- `auth.users` entry (via service role) with confirmed email like `student001@zyntra-synthetic.test`
- `profiles` row (name, exam_date, user_type, country, medical_college, etc.)
- `readiness_dna` row (clinical_accuracy 40-95%, stability 50-98%, time_management 30-120s, etc.)
- `behavior_profiles` row (rush/hesitation/fatigue indices, archetype randomly assigned)
- `subject_dna` rows (one per AMC subject: Medicine, Surgery, OB&G, Paediatrics, Psychiatry, Population Health — with realistic accuracy/stability/gap scores)
- `user_attempts` rows (5-30 attempts per user across random questions from the question bank)

**Approach:** A single Edge Function `admin-seed-synthetic-users` that:
- Accepts `{ count: 100 }` from admin
- Uses service role to create auth users with auto-confirmed emails
- Generates randomized but bell-curve-distributed metrics
- Inserts all rows in batches
- Returns a summary of created users

**Files:**
- `supabase/functions/admin-seed-synthetic-users/index.ts` (new)

### Task 2: Add "Full Mock" Mode to Practice Drills

Add a third mode card alongside "Recharge Answer" and "No Change" in the SetupScreen.

**Full Mock rules:**
- Fixed 150 questions, 210 minutes (3h 30m)
- Answer locked immediately on selection (like no-change)
- Cannot navigate back to previous questions
- Question count selector and presets hidden when Full Mock is selected
- Mode value: `'full-mock'` added to `SessionConfig.mode` union type

**UI changes in `SetupScreen`:**
- Add third card with a shield/target icon, title "Full Mock", description: "150 questions in 210 minutes. Answers lock on selection. No going back."
- When selected: hide question count section, force `questionCount = 150`
- Grid changes from `sm:grid-cols-2` to `sm:grid-cols-3`

**Drill behavior changes in `DrillSession`:**
- `canChangeAnswer = config.mode === 'recharge'` (already handles full-mock as locked)
- Timer: `config.mode === 'full-mock' ? 210 * 60 : config.questionCount * 60`
- Disable "Previous" navigation button when mode is `full-mock`

**Files:**
- `src/pages/Practice.tsx` — update `SessionConfig`, `SetupScreen`, and `DrillSession`

### Technical Details

- The synthetic user edge function uses `createClient` with `SUPABASE_SERVICE_ROLE_KEY` for auth.admin.createUser
- Admin authorization via `admin_roles` table check
- Emails follow pattern `synth-student-{NNN}@zyntra-demo.test` to be easily identifiable
- Each synthetic user gets a random subset of 6 AMC subjects with varying performance levels
- The Full Mock mode reuses existing drill infrastructure — only config and UI constraints change


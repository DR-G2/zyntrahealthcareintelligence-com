

## Intelligence System — 10-Phase Implementation Plan

### Current State Assessment

Much of this system **already exists** in various forms:

| Requested | Existing Equivalent | Gap |
|-----------|-------------------|-----|
| Phase 1 — Ideal Candidate Profile | None | **New table needed** |
| Phase 2 — Raw data collection | `user_attempts` table | Already has all fields except `confidence_level`. Minor gap. |
| Phase 3 — Readiness DNA aggregation | `performance_profiles` table + client-side computation in `ReadinessDNA.tsx` | Need `readiness_dna` precomputed table with `distance_from_ideal` |
| Phase 4 — Question DNA | `question_difficulty_tiers` table | Missing behavioral fields (trap_type, confidence_error_rate). Need richer `question_dna` table |
| Phase 5 — Behavioral archetypes | `behavior_profiles` table | Already has archetype, trap_flags, signals. Missing rush/hesitation/fatigue indices |
| Phase 6 — Distance from ideal | None | New computation, stored in readiness_dna |
| Phase 7 — Subject DNA mapping | Client-side in `ReadinessDNA.tsx` | Need precomputed `subject_dna` table |
| Phase 8 — Adaptive training | `sequencing.ts` + `select-adaptive-stations` | Existing tier-based system. Need weakness-weighted session generation |
| Phase 9 — Dashboard queries | Queries hit raw `user_attempts` | Need to switch to precomputed tables |
| Phase 10 — Continuous learning | `retrain-ai-context` edge function (manual) | Need DB triggers for automatic incremental updates |

### Implementation Plan

#### Phase 1 — Ideal Candidate Profile Table

Create `ideal_candidate_profile` table with seed data:

```sql
CREATE TABLE ideal_candidate_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL UNIQUE,
  min_value numeric NOT NULL,
  max_value numeric NOT NULL,
  target_value numeric NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Seed records
INSERT INTO ideal_candidate_profile (metric, min_value, max_value, target_value, description) VALUES
('accuracy', 70, 80, 75, 'Clinical accuracy percentage'),
('avg_time', 45, 60, 52, 'Average seconds per question'),
('answer_stability', 92, 100, 95, 'Percentage of answers not changed'),
('confidence_calibration', 75, 100, 80, 'Confidence-correctness alignment'),
('subject_balance', 50, 100, 65, 'Minimum subject accuracy threshold');
```

RLS: SELECT for authenticated users, no INSERT/UPDATE/DELETE from client.

#### Phase 2 — Raw Data Collection (Minimal Changes)

The `user_attempts` table already captures: `selected_answer`, `is_correct`, `time_taken_seconds`, `answer_changes_count`, `time_to_first_click`, `pause_events`, `change_sequence`. No schema change needed — existing table is sufficient.

#### Phase 3 — Readiness DNA Precomputed Table

Create `readiness_dna` table:

```sql
CREATE TABLE readiness_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  clinical_accuracy numeric DEFAULT 0,
  answer_stability numeric DEFAULT 0,
  time_management numeric DEFAULT 0,
  confidence_calibration numeric DEFAULT 0,
  readiness_score numeric DEFAULT 0,
  distance_from_ideal numeric DEFAULT 0,
  attempt_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
```

RLS: Users can SELECT/INSERT/UPDATE own rows.

#### Phase 4 — Question DNA Table

Create `question_dna` table (supplements existing `question_difficulty_tiers`):

```sql
CREATE TABLE question_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL UNIQUE,
  accuracy_rate numeric DEFAULT 0,
  average_time numeric DEFAULT 0,
  answer_change_rate numeric DEFAULT 0,
  confidence_error_rate numeric DEFAULT 0,
  difficulty_score numeric DEFAULT 50,
  trap_type text,
  attempt_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
```

RLS: SELECT for authenticated users.

#### Phase 5 — Behavior Profile Enhancement

Add three index columns to existing `behavior_profiles` table:

```sql
ALTER TABLE behavior_profiles
ADD COLUMN IF NOT EXISTS rush_index numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS hesitation_index numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS fatigue_index numeric DEFAULT 0;
```

#### Phase 6 — Distance from Ideal (DB Function)

Create a SQL function that computes distance and is called by the trigger:

```sql
CREATE OR REPLACE FUNCTION compute_distance_from_ideal(
  p_accuracy numeric, p_stability numeric,
  p_time numeric, p_calibration numeric
) RETURNS numeric AS $$
  SELECT ROUND(
    ABS(p_accuracy - (SELECT target_value FROM ideal_candidate_profile WHERE metric = 'accuracy')) +
    ABS(p_stability - (SELECT target_value FROM ideal_candidate_profile WHERE metric = 'answer_stability')) +
    ABS(p_time - (SELECT target_value FROM ideal_candidate_profile WHERE metric = 'avg_time')) +
    ABS(p_calibration - (SELECT target_value FROM ideal_candidate_profile WHERE metric = 'confidence_calibration'))
  , 2);
$$ LANGUAGE sql STABLE;
```

#### Phase 7 — Subject DNA Table

Create `subject_dna` per-user per-subject precomputed table:

```sql
CREATE TABLE subject_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  accuracy numeric DEFAULT 0,
  attempt_count integer DEFAULT 0,
  avg_time numeric DEFAULT 0,
  stability numeric DEFAULT 0,
  gap_score numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, subject)
);
```

RLS: Users can SELECT/INSERT/UPDATE own rows.

#### Phase 8 — Adaptive Training Enhancement

Update `src/lib/sequencing.ts` to use `subject_dna` and `readiness_dna`:
- Query `subject_dna` to get per-subject gap scores
- Weight question selection: 60% from subjects with highest gap_score, 30% moderate, 10% strong
- Avoid recently-attempted question_ids (last 48 hours)

No new tables — logic change in existing sequencing code + Practice.tsx setup.

#### Phase 9 — Dashboard Query Migration

Update three components to read from precomputed tables instead of raw `user_attempts`:
- `ReadinessDNA.tsx` → read from `readiness_dna` + `subject_dna`
- `ReadinessScore.tsx` → read from `readiness_dna`
- `BehaviorProfile.tsx` → already reads `behavior_profiles` (no change)

This eliminates heavy client-side aggregation of thousands of raw rows.

#### Phase 10 — Continuous Learning Triggers

Create a single PL/pgSQL trigger function on `user_attempts` INSERT that incrementally updates:

1. `readiness_dna` — recalculates accuracy, stability, time metrics from running averages
2. `question_dna` — updates per-question stats
3. `subject_dna` — updates per-user per-subject stats
4. `behavior_profiles` — updates rush/hesitation/fatigue indices
5. Calls `compute_distance_from_ideal()` to update distance

```sql
CREATE OR REPLACE FUNCTION update_intelligence_on_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
-- Incrementally updates readiness_dna, question_dna, subject_dna
-- Uses running average formulas to avoid full recomputation
$$;

CREATE TRIGGER trg_update_intelligence
AFTER INSERT ON user_attempts
FOR EACH ROW EXECUTE FUNCTION update_intelligence_on_attempt();
```

### Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Create `ideal_candidate_profile`, `readiness_dna`, `question_dna`, `subject_dna` tables + trigger + seed data |
| Migration SQL | ALTER `behavior_profiles` add index columns |
| `src/components/ReadinessDNA.tsx` | Read from `readiness_dna` + `subject_dna` instead of raw attempts |
| `src/components/ReadinessScore.tsx` | Read from `readiness_dna` instead of raw attempts |
| `src/lib/sequencing.ts` | Add gap-weighted question selection using `subject_dna` |
| `src/pages/Practice.tsx` | Fetch `subject_dna` for adaptive session setup |

### Cost Optimization

- Zero AI usage — all intelligence is SQL triggers + precomputed tables
- Dashboard loads go from querying thousands of `user_attempts` rows to single-row lookups
- Incremental updates via trigger (no batch recomputation needed)
- `retrain-ai-context` edge function remains available for manual full recomputation if needed




## Competitive Intelligence: AMC PrepBlitz vs Zyntra — Full System Upgrade

### PART 1: What They Do Well (Already Matched)

These features were implemented in previous rounds and are now at parity or superior:
- SRS Flashcards (we have SM-2 algorithm + auto-generation from mistakes)
- AI Voice Practice (Web Speech API in OSCE stations)
- Gold-Standard Coaching (model answer walkthroughs)
- Real AMC Scoring (domain-by-domain)
- 50+ Clinical Stations
- Contact Form + FAQ on Landing
- Privacy Policy + Terms expansions
- Mobile-responsive design

### PART 2: Remaining Gaps (What We Still Lack)

| Gap | PrepBlitz | Zyntra Status |
|-----|-----------|---------------|
| Guided Program Mode | Step-by-step "How It Works" flow: Pick → Practice → Score → Review | Tool-based, no guided journey |
| "Try a Free Station" CTA | Instant one-click OSCE demo, no signup | Requires login + mode selection |
| Structured Training Pathway | Implied beginner→advanced progression | Flat topic list, no progression |
| Clinical Thinking Trainer | Decision-based prioritization within stations | Checklist-only, no decision training |
| Program Packaging | Branded as a "preparation program" | Positioned as a "tool/platform" |
| Next Best Step Engine | N/A (gap for both) | We can build this first |
| Landing page "How It Works" carousel | Visual step-by-step with station cards | Generic feature grid |

### PART 3: Systems to Build (7 Items)

---

#### 1. GUIDED PROGRAM MODE — "AMC Mastery Program"

Transform the Dashboard from a stats page into a guided preparation journey.

**New component**: `src/components/ProgramTracker.tsx`

Three named tracks displayed as horizontal progress lanes on Dashboard:
- **Clinical Reasoning Track** (MCQ-focused): 4 stages — Foundation (easy questions) → Application (moderate) → Integration (hard) → Exam Simulation (full mock)
- **OSCE Readiness Track** (Station-focused): 4 stages — Communication Basics → History Taking → Examination Skills → Full Circuit
- **Mastery Track** (combined): Unlocks after completing Stage 2 of both tracks

Each stage has:
- A completion threshold (e.g., "Score 60%+ on 20 Foundation questions")
- A locked/unlocked state
- Progress percentage
- "Start Next Session" button that pre-configures Practice/Stations with appropriate difficulty

**Database**: New `user_program_progress` table:
```
id, user_id, track (text), stage (integer), progress_pct (numeric),
unlocked (boolean), completed_at (timestamptz), updated_at
```
RLS: user-scoped ALL policy.

**Files**: `src/components/ProgramTracker.tsx`, update `src/pages/Dashboard.tsx`

---

#### 2. "TRY A FREE STATION" — Public Demo Flow

Add a "Try a Free Station" button on the Landing page that routes to `/stations?demo=true`.

On the Stations page, detect `demo=true` query param:
- Skip mode selection, auto-select "instant" mode
- Auto-select a curated demo station (e.g., "Chest Pain — Cardiology")
- If user is not logged in, show a simplified version with the station chat only (no saving results)
- After completion, show results + strong CTA: "Sign up to unlock all 50+ stations"

**Files**: Update `src/pages/Landing.tsx` (add CTA button), update `src/pages/Stations.tsx` (add demo flow detection)

---

#### 3. NEXT BEST STEP ENGINE

A persistent widget on Dashboard that analyzes the user's current state and recommends exactly one action.

**Logic** (computed client-side from existing data):
- No attempts yet → "Take your Diagnostic MCQ assessment"
- Low accuracy in a subject → "Practice 10 [Subject] questions"
- High rush index → "Try a Recharge session (no answer changes)"
- No OSCE attempts → "Complete your first OSCE station"
- Flashcards due → "Review [N] flashcards due today"
- All good → "Run a Full Mock exam"

**New component**: `src/components/NextBestStep.tsx`
- Queries `readiness_dna`, `subject_dna`, `behavior_profiles`, `flashcard_reviews`
- Renders as a prominent card with icon, recommendation text, and action button
- Links directly to the recommended page with pre-configured params

**Files**: `src/components/NextBestStep.tsx`, update `src/pages/Dashboard.tsx`

---

#### 4. CLINICAL THINKING TRAINER

Add a "Decision Points" mode within existing MCQ Practice.

When enabled, after answering a question correctly, the system presents a follow-up decision chain:
- "What is your first-line investigation?" (from `first_line_investigation` field)
- "What is the gold-standard investigation?" (from `gold_standard_investigation` field)  
- "What is the best treatment?" (from `best_treatment` field)

These fields already exist in the `questions` table. Currently they're only shown in explanations.

**Implementation**: Add a toggle "Clinical Thinking Mode" in the Practice setup screen. When active, after a correct answer, show 1-3 follow-up prompts before moving to the next question. Track clinical thinking accuracy separately.

**Files**: Update `src/pages/Practice.tsx` (add toggle + follow-up flow)

---

#### 5. LANDING PAGE "HOW IT WORKS" UPGRADE

Replace the current generic feature grid with PrepBlitz's superior step-by-step visual flow:

1. **Pick a Station** — Show scrolling station cards (Chest Pain, Diabetes, etc.)
2. **Talk to Your AI Partner** — Voice practice visual
3. **Get Instant Feedback** — AMC scoring visual
4. **Fill the Gaps** — Flashcard review visual
5. **Track Your Progress** — Analytics dashboard visual

Use a horizontal stepper/carousel with animated transitions.

**Files**: Update `src/pages/Landing.tsx`

---

#### 6. EDUCATIONAL PACKAGING — Track Labels

Rebrand sidebar navigation to reflect program structure:

Current sidebar groups:
- "Learn & Practice" → rename to **"Training Program"**
- "APPE" → keep as is
- "Study Companion" → rename to **"Study Tools"**

Add track badges next to MCQ and OSCE nav items showing current stage (e.g., "Stage 2/4").

**Files**: Update `src/components/AppSidebar.tsx`

---

#### 7. PROGRESSION GATING

Enhance the existing `useFeatureGate` hook to support stage-based gating for free users:

- Free users can only access Stage 1 (Foundation) content
- Stage 2+ requires paid subscription
- Show a "Complete Stage 1 to unlock" prompt instead of generic upgrade prompt
- Paid users have all stages unlocked

This uses the `user_program_progress` table from Task 1.

**Files**: Update `src/hooks/useFeatureGate.ts`, update `src/components/UpgradePrompt.tsx`

---

### PART 4: Implementation Priority

1. **Next Best Step Engine** — highest UX impact, no DB changes, pure client logic
2. **Program Tracker + DB table** — transforms Zyntra from tool to program
3. **Landing page upgrade** — improves conversion
4. **Try a Free Station** — reduces signup friction
5. **Clinical Thinking Trainer** — leverages existing data fields
6. **Educational Packaging** — sidebar relabeling
7. **Progression Gating** — ties everything together

### PART 5: Database Changes

One new table:

```sql
CREATE TABLE public.user_program_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track text NOT NULL,           -- 'clinical_reasoning', 'osce_readiness', 'mastery'
  stage integer NOT NULL DEFAULT 1,
  progress_pct numeric NOT NULL DEFAULT 0,
  unlocked boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, track, stage)
);

ALTER TABLE public.user_program_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress"
  ON public.user_program_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### PART 6: Zyntra Differentiation (Already Built, Now Integrated)

Every new feature above connects to existing Zyntra-exclusive systems:

- **Next Best Step** reads from Readiness DNA + Behavior Profiles
- **Program Tracker** stages are informed by Subject DNA accuracy scores
- **Clinical Thinking Trainer** feeds into Question DNA metrics
- **Progression Gating** uses Readiness Score thresholds

This creates a closed-loop intelligence system that no competitor has.

### Files Summary

| Action | File |
|--------|------|
| Create | `src/components/NextBestStep.tsx` |
| Create | `src/components/ProgramTracker.tsx` |
| Create | Migration for `user_program_progress` |
| Update | `src/pages/Dashboard.tsx` (add NextBestStep + ProgramTracker) |
| Update | `src/pages/Landing.tsx` (How It Works upgrade + Try Free Station CTA) |
| Update | `src/pages/Stations.tsx` (demo flow) |
| Update | `src/pages/Practice.tsx` (Clinical Thinking Mode toggle + follow-ups) |
| Update | `src/components/AppSidebar.tsx` (rename groups + stage badges) |
| Update | `src/hooks/useFeatureGate.ts` (stage-based gating) |
| Update | `src/components/UpgradePrompt.tsx` (stage-aware messaging) |


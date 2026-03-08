

## Plan: APPE Clinical Station Training System

### Overview
Build a new `/stations` page with three modes: **Exam Mode** (16 fixed stations), **Adaptive Training Mode** (AI-driven selection), and **Single Station Instant Mode**. Each station uses a **Hybrid format**: AI chat for history-taking, then structured checklists for examination/investigations/management.

### Database Changes

**New table: `clinical_stations`** — stores AI-generated station scenarios
- `id`, `user_id`, `session_id`, `subject` (text), `scenario_title`, `scenario_data` (jsonb — patient persona, expected findings, checklist items, marking criteria), `created_at`

**New table: `station_attempts`** — stores completed station results
- `id`, `user_id`, `session_id`, `station_index` (int), `subject`, `mode` (exam/adaptive/instant), `chat_transcript` (jsonb), `checklist_responses` (jsonb), `scores` (jsonb — communication, clinical safety, structure, etc.), `psychograph` (jsonb — 6 dimensions), `behavioral_signals` (jsonb), `time_taken_seconds`, `created_at`

**New table: `psychograph_history`** — longitudinal tracking
- `id`, `user_id`, `cognitive_stability`, `emotional_reactivity`, `time_compression_vulnerability`, `silence_tolerance`, `delegation_confidence`, `structure_integrity` (all numeric 0-100), `archetype` (text), `session_id`, `created_at`

All tables with RLS: users can only CRUD their own rows.

### New Edge Functions

**1. `supabase/functions/generate-station/index.ts`**
- Input: `{ subject, mode }` 
- Uses Lovable AI (gemini-2.5-pro) with tool calling to generate a structured station scenario:
  - Patient persona (name, age, presenting complaint, hidden history, emotional state)
  - AI patient system prompt for the chat phase
  - Examination findings checklist (correct/incorrect items)
  - Investigation options with correct selections
  - Management plan checklist
  - Marking rubric (communication score, clinical safety items, structure items)
- Returns structured JSON via tool calling

**2. `supabase/functions/evaluate-station/index.ts`**
- Input: `{ chat_transcript, checklist_responses, scenario_data, behavioral_signals }`
- AI evaluates the consultation against the marking rubric
- Generates scores per domain + psychograph (6 dimensions from behavioral signals)
- Returns: `{ scores, psychograph, recommendations, archetype }`

**3. `supabase/functions/station-patient-chat/index.ts`**
- Streaming chat function — AI plays the patient role
- Input: `{ messages, patient_persona }` (persona from generate-station)
- System prompt instructs AI to stay in character, respond realistically, show emotional cues
- Tracks behavioral signals: response timing passed from client

**4. `supabase/functions/select-adaptive-stations/index.ts`**
- Input: `{ psychograph, completed_subjects }`
- AI selects next station subject based on psychograph weaknesses
- Returns: `{ next_subject, reasoning }`

### New Page: `src/pages/Stations.tsx`

**Three-phase page with mode selection:**

**Phase 1 — Mode Selection**
- Three cards: Exam Mode, Adaptive Training, Single Station
- Each with description and icon

**Phase 2 — Setup (varies by mode)**
- **Single Station**: Grid of 14 subject cards (from filter-data SYSTEMS). Select one → Start.
- **Adaptive Training**: Brief explanation → Start (Station 1 is always Psychiatry)
- **Exam Mode**: Brief explanation → Start 16-Station Circuit

**Phase 3 — Station Execution (4 tabs, timed)**
- 8-minute timer per station
- **Tab 1: History Taking** — AI chat interface (streaming). User types questions to the AI patient. Chat messages displayed with markdown. Behavioral tracking: time between messages, message length, silence gaps.
- **Tab 2: Examination** — Checklist of examination findings. User selects which they would perform. Some correct, some distractors.
- **Tab 3: Investigations** — Checklist of investigations to order. Select appropriate ones.
- **Tab 4: Management** — Checklist of management actions + free-text management plan.
- Navigation: Next tab button, can go back. Final "Submit Station" button.

**Phase 4 — Results**
- **Single Station / After each Adaptive station**: Immediate results
  - Overall score (percentage)
  - Domain breakdown: Communication, Clinical Reasoning, Safety, Time Management
  - Psychograph radar chart (Recharts RadarChart) with 6 dimensions
  - Archetype badge
  - AI-generated recommendations (markdown)
  - Chat transcript review with annotations
- **Exam Mode**: Results only after all 16 stations complete — summary dashboard

### Navigation
- Add to `AppSidebar.tsx`: `{ to: '/stations', label: 'Stations', icon: Activity }`
- Add to `App.tsx`: `/stations` route wrapped in `ProtectedRoute`

### Psychograph Computation
Client sends behavioral signals to `evaluate-station`:
- `avg_response_time` — time between patient message and user reply
- `silence_gaps` — count of gaps > 15s
- `message_count` — total messages sent
- `avg_message_length` — words per message
- `tab_switch_pattern` — time spent per tab
- `checklist_change_count` — how many times selections changed

AI maps these to 6 dimensions (0-100) and classifies an archetype.

### Adaptive Mode Flow
1. Station 1 = Psychiatry (always). Generate scenario → execute → evaluate → get psychograph.
2. Call `select-adaptive-stations` with psychograph → get next subject.
3. Generate station for that subject → execute → evaluate → update psychograph.
4. Repeat for stations 3-16 with progressive difficulty.
5. Final summary after station 16.

### Files Summary

| File | Action |
|------|--------|
| `src/pages/Stations.tsx` | Create — main page with all phases |
| `src/components/stations/StationChat.tsx` | Create — AI patient chat component |
| `src/components/stations/StationChecklist.tsx` | Create — examination/investigation/management checklists |
| `src/components/stations/StationResults.tsx` | Create — results + psychograph display |
| `src/components/stations/PsychographRadar.tsx` | Create — reusable radar chart component |
| `supabase/functions/generate-station/index.ts` | Create |
| `supabase/functions/evaluate-station/index.ts` | Create |
| `supabase/functions/station-patient-chat/index.ts` | Create |
| `supabase/functions/select-adaptive-stations/index.ts` | Create |
| `src/components/AppSidebar.tsx` | Modify — add nav item |
| `src/App.tsx` | Modify — add route |
| `supabase/config.toml` | Modify — add 4 function entries |
| DB migration | Create 3 tables + RLS policies |

### Not Modified
- Practice drills, Question bank, Dashboard, Diagnostic assessment, or any existing pages


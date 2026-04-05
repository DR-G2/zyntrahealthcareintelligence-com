

## Feature Gap Analysis: AMC PrepBlitz vs Zyntra

After analyzing amcprepblitz.com, three features stand out that we lack:

### Features They Have That We Don't

| Feature | PrepBlitz | Zyntra |
|---------|-----------|--------|
| SRS Flashcards | Spaced repetition decks per subject | None |
| AI Voice Practice | Voice-based OSCE roleplay | Text chat only |
| Gold-Standard Coaching | Demo walkthroughs showing "clear pass" answers | None |
| AMC Scoring | Domain-by-domain | We have this already |
| 50+ Stations | Yes | We have this already |
| Analytics | Basic dashboard | We have much more |

---

### What I Would Build (Priority Order)

#### 1. SRS Flashcard System (Highest Impact, Most Differentiated Gap)

**New page**: `/flashcards` accessible from sidebar

**Database**:
- `flashcard_decks` table: id, user_id, title, subject, card_count, created_at
- `flashcards` table: id, deck_id, front (question/concept), back (answer/explanation), subject, subtopic
- `flashcard_reviews` table: id, user_id, flashcard_id, ease_factor, interval_days, next_review_at, repetitions, created_at

**How it works**:
- Auto-generate flashcards from incorrect MCQ attempts and OSCE weak areas using AI
- SM-2 spaced repetition algorithm (same as Anki) for scheduling reviews
- Cards show front (clinical question/concept), user rates recall (Again / Hard / Good / Easy)
- Daily review queue sorted by due date
- Subject-grouped decks with progress indicators
- "Cards due today" counter on Dashboard

**Files**:
- `src/pages/Flashcards.tsx` (main page with deck list + review mode)
- `src/lib/sm2.ts` (SM-2 algorithm)
- `supabase/functions/generate-flashcards/index.ts` (AI generates cards from weak areas)
- Migration for 3 new tables
- Sidebar nav entry

#### 2. AI Voice Practice for OSCE Stations

**Enhancement to existing Stations page**

- Add a "Voice Mode" toggle button next to the existing text chat
- Uses Web Speech API (`SpeechRecognition` for input, `SpeechSynthesis` for patient responses)
- No external API needed -- browser-native
- Transcribes user speech to text, sends to existing `station-patient-chat` edge function
- Patient response is spoken aloud via TTS
- Visual waveform indicator during listening/speaking
- Falls back to text chat on unsupported browsers

**Files**:
- `src/components/stations/VoiceChat.tsx` (voice UI with mic button, waveform, transcript)
- `src/hooks/useVoiceChat.ts` (SpeechRecognition + SpeechSynthesis wrapper)
- Minor updates to `StationChat.tsx` to support voice mode toggle

#### 3. Gold-Standard Coaching (Model Answer Walkthroughs)

**Enhancement to Station Results page**

- After completing a station, show a "See Model Answer" expandable section
- AI generates a "clear pass" walkthrough: what the ideal candidate would say at each checklist item
- Displayed as a structured timeline with checklist items mapped to ideal responses
- Stored for reuse so it's not re-generated each time

**Files**:
- `supabase/functions/generate-model-answer/index.ts` (AI generates ideal consultation walkthrough)
- `src/components/stations/ModelAnswerCoaching.tsx` (expandable coaching panel)
- Update `StationResults.tsx` to include the coaching component
- `model_answers` table: station_id, subject, scenario_title, model_walkthrough (jsonb), created_at

---

### Implementation Order

1. **SRS Flashcards** -- 3 tables + 1 edge function + 1 page + algorithm
2. **Voice Practice** -- Frontend-only (Web Speech API), no DB changes
3. **Model Answer Coaching** -- 1 table + 1 edge function + 1 component

### Technical Notes

- Flashcard SM-2 algorithm is deterministic, runs client-side
- Voice chat uses zero-cost browser APIs; no third-party speech service needed
- Model answers use Lovable AI (gemini-3-flash-preview) for generation
- All new tables get standard user-scoped RLS policies
- Flashcard generation triggers from "Generate from my mistakes" button + manual card creation


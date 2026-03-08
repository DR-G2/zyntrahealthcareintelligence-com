

## Plan: AI-Powered Study Plan + Study Buddy Chatbot

### Overview

Two features: (1) Replace the static study plan logic with AI-generated personalized recommendations via an edge function, and (2) Add a floating study buddy chatbot accessible from any page that can explain medical concepts and review missed questions.

---

### 1. AI Study Plan Generator

**Edge function:** `supabase/functions/generate-study-plan/index.ts`

- Receives user's performance DNA: category stats (per-category accuracy from `user_attempts`), `performance_profiles` metrics, `profiles.weak_areas`, exam date, and days remaining
- Calls Lovable AI (`google/gemini-3-flash-preview`) with tool calling to return structured output:
  - `focus_areas`: prioritized list with category, priority level, recommended daily questions, and specific study tips
  - `weekly_schedule`: 7-day plan with topics and question counts per day
  - `recommendations`: 3-5 personalized actionable tips based on the user's specific weaknesses
  - `motivation`: a short encouraging message based on readiness level
- Saves the generated plan to the `study_plans` table (tasks = the full AI output as JSON)
- Returns the structured plan to the frontend

**Config:** Add `[functions.generate-study-plan]` with `verify_jwt = false` to `supabase/config.toml`.

**Frontend changes to `src/pages/StudyPlan.tsx`:**

- Add a "Generate AI Plan" button that sends performance data to the edge function
- Show a loading state while generating
- Display AI-generated plan sections (replaces the current static `useMemo` logic for weekly schedule and recommendations)
- Cache the last generated plan in `study_plans` table; show cached plan on load, with option to regenerate
- Keep the existing Readiness Summary and Focus Areas cards (data-driven, no AI needed)

---

### 2. Study Buddy Chatbot

**Edge function:** `supabase/functions/study-buddy/index.ts`

- Streaming chat endpoint using Lovable AI (`google/gemini-3-flash-preview`)
- System prompt: AMC exam tutor persona — explains medical concepts at exam level, uses Australian clinical guidelines, references structured explanation framework (diagnosis, differentials, investigations, treatments)
- Accepts full conversation history from client
- Optional `context` field: when user asks about a specific question, the client sends the question data (vignette, options, correct answer, explanation) so the AI can reference it
- Handles 429/402 errors gracefully

**Config:** Add `[functions.study-buddy]` with `verify_jwt = false` to `supabase/config.toml`.

**Frontend: `src/components/StudyBuddy.tsx`**

- Floating chat button (bottom-right corner) with a chat panel that slides up
- Token-by-token streaming using SSE parsing (per the AI gateway pattern)
- Markdown rendering for AI responses (`react-markdown` — needs to be installed)
- Pre-built quick actions:
  - "Explain this question" — available when viewing a question explanation, sends question context
  - "Help me understand [category]" — quick prompts for weak areas from profile
- Conversation stored in local state (no persistence needed unless user asks)
- Accessible from all pages via `AppLayout`

**Integration with question review:**
- Add a "Ask Study Buddy" button to `QuestionExplanation.tsx` that opens the chatbot pre-loaded with the question context

---

### 3. Database Changes

**No migrations needed.** The existing `study_plans` table has `tasks` (jsonb) and `focus_areas` (array) columns which will store the AI output.

---

### File Changes Summary

| File | Action |
|------|--------|
| `supabase/functions/generate-study-plan/index.ts` | Create — AI study plan generator |
| `supabase/functions/study-buddy/index.ts` | Create — streaming chatbot endpoint |
| `supabase/config.toml` | Add both new functions |
| `src/pages/StudyPlan.tsx` | Update — add AI generate button, display AI plan |
| `src/components/StudyBuddy.tsx` | Create — floating chatbot component |
| `src/components/AppLayout.tsx` | Add StudyBuddy component |
| `src/components/practice/QuestionExplanation.tsx` | Add "Ask Study Buddy" button |
| `package.json` | Add `react-markdown` dependency |


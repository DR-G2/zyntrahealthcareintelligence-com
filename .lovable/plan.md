

## Plan: Chat Persistence, Spaced Repetition, and E2E Testing

### 1. Conversation Persistence for Study Buddy

**Database migration:** Create a `chat_conversations` table to store conversations.

```sql
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_context jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- RLS: users can CRUD own conversations
CREATE POLICY "Users can view own conversations" ON public.chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.chat_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.chat_conversations FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Frontend changes to `src/components/StudyBuddy.tsx`:**
- On component mount, load user's conversations list from `chat_conversations` (ordered by `updated_at desc`, limit 20)
- Add a conversation list view in the header area — small dropdown or sidebar showing past conversations with titles
- Add "New Chat" button to start a fresh conversation
- Auto-save messages to the active conversation after each assistant response completes (debounced upsert)
- Auto-generate title from first user message (truncated to 50 chars)
- Add delete conversation option
- Requires importing `supabase` client and `useAuth` for user_id

### 2. Spaced Repetition in AI Study Plan

**Changes to `supabase/functions/generate-study-plan/index.ts`:**
- Before calling AI, query `user_attempts` to get the **last practice date per category** using `MAX(created_at)` grouped by category
- Calculate days since last practice for each category
- Add this data to the AI prompt:
  ```
  - Last practiced per category: {"Cardiology": "3 days ago", "Neurology": "14 days ago", ...}
  - Categories never practiced: [list]
  ```
- Update the tool schema to include a `spaced_repetition_notes` field in each focus area item (string explaining the spacing rationale)

**Changes to `src/pages/StudyPlan.tsx`:**
- Pass `lastPracticedByCategory` data to the edge function (fetched from `user_attempts` with a grouped query)
- Display spaced repetition notes in the focus areas section if present

### 3. E2E Testing Prep

After implementation, I'll navigate to the Study Plan page and the Study Buddy chatbot to verify:
- AI plan generates and renders correctly
- Chat messages persist across panel close/reopen
- Conversation history loads on revisit
- Spaced repetition data appears in the AI plan output

---

### File Changes Summary

| File | Action |
|------|--------|
| Migration SQL | Create `chat_conversations` table with RLS |
| `src/components/StudyBuddy.tsx` | Add persistence: load/save conversations, conversation list, new chat button |
| `supabase/functions/generate-study-plan/index.ts` | Add last-practiced-per-category query and spaced repetition prompt data |
| `src/pages/StudyPlan.tsx` | Pass last practiced data, display spaced repetition notes |


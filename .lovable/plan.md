

## Plan: Add Onboarding Hints to Practice, Stations & AI Chat

Add `OnboardingTooltip` components to three pages, shown once per user (dismissed via localStorage).

### Changes

**`src/pages/Practice.tsx`** — Insert after the page heading (line ~201), before mode selection:
- Hint: "Welcome to Practice Drills" — explains Recharge vs No Change modes and topic filtering

**`src/pages/Stations.tsx`** — Insert after the page heading (line ~269), before mode cards:
- Hint: "Welcome to Clinical Stations" — explains the 3 modes (Single, Adaptive, Exam) and the AI patient chat

**`src/pages/CompanionChat.tsx`** — Insert at the top of the main chat area (inside the chat column, before the ScrollArea around line ~237):
- Hint: "Meet your AI Study Buddy" — explains conversation history, quick prompts, and markdown support

Each tooltip uses a unique `id` prop (e.g., `practice-intro`, `stations-intro`, `chat-intro`) so they're independently dismissible.

### Files

| File | Action |
|------|--------|
| `src/pages/Practice.tsx` | Import `OnboardingTooltip`, add after heading |
| `src/pages/Stations.tsx` | Import `OnboardingTooltip`, add after heading |
| `src/pages/CompanionChat.tsx` | Import `OnboardingTooltip`, add in chat area |


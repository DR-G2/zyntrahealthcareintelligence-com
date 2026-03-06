

## Problem Identified

The diagnostic doesn't load because the **questions table has RLS enabled** with a policy that only allows **authenticated** users to read. Since we removed login, the app uses the **anon** role, which is blocked. The API returns an empty array `[]`, causing the "Failed to load questions" toast and crashes in Practice.tsx.

## Plan

### 1. Add public read policy on questions table
Run a migration to add an RLS policy allowing the `anon` role to SELECT from the `questions` table. This makes questions readable without authentication.

```sql
CREATE POLICY "Questions are readable by everyone"
ON public.questions FOR SELECT TO anon USING (true);
```

### 2. Fix Practice.tsx crash
The runtime error shows `Cannot read properties of undefined (reading 'options')` at line 616 in Practice.tsx. The drill session tries to access a question's options before questions are loaded. Add a guard to check that the current question exists before rendering.

### 3. Fix Assess.tsx empty questions handling
Add a guard so that if questions come back empty, the test phase doesn't start with undefined question objects. The current code already has a toast, but the UI still tries to render.

These three changes will unblock the diagnostic flow entirely.


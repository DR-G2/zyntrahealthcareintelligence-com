

## Plan: Bulk Import with Auto-Tagging and Progress Indicator

### Problem
The current import sends all questions in one call with no progress feedback. The edge function also ignores `question_type` from the payload.

### Changes

**1. Update `supabase/functions
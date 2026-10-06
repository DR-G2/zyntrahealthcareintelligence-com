# Zyntra V2 Phase 8

The frontend now has an isolated V2 Supabase client.

Environment variables required for V2 testing:
- VITE_SUPABASE_V2_URL
- VITE_SUPABASE_V2_PUBLISHABLE_KEY

The existing production Supabase client remains unchanged. No live route has been switched.

Supabase Auth remains the single identity system. V2 profiles.id matches auth.users.id.

Before real-user migration, test sign-in, profile creation, RLS isolation, owned-session attempt saving, rejection of another user's session, and learner-safe question/station access.

Next: build and test V2 compatibility adapters for Practice, OSCE, Intelligence, AI Lab and Admin before final frontend cutover.

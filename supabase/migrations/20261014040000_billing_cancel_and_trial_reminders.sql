-- Billing lifecycle columns + hourly trial-reminder schedule.
-- NOT applied live by this PR; apply through the normal release process.
alter table public.payments
  add column if not exists trial_end_at timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists trial_reminder_sent_at timestamptz;

create index if not exists payments_trial_reminder_due_idx
  on public.payments (trial_end_at)
  where trial_reminder_sent_at is null and status = 'active';

-- pg_cron / pg_net must be enabled in the dashboard (Database > Extensions) for the schedule below.
create extension if not exists pg_net;

-- Requires Vault secrets: 'project_url' (https://<ref>.supabase.co) and 'trial_reminder_cron_secret'
-- (same value as the edge function env TRIAL_REMINDER_CRON_SECRET).
-- Guarded: only schedules when pg_cron is actually installed (otherwise this migration still applies;
-- schedule the job manually once pg_cron is enabled).
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed: trial-reminder-email-hourly NOT scheduled';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE WARNING 'supabase_vault and/or pg_net not installed: trial-reminder-email-hourly NOT scheduled';
  ELSIF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url' AND coalesce(decrypted_secret, '') <> '')
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'trial_reminder_cron_secret' AND coalesce(decrypted_secret, '') <> '') THEN
    RAISE WARNING 'Vault secret project_url and/or trial_reminder_cron_secret is MISSING: trial-reminder-email-hourly NOT scheduled. Create both, then re-run this block.';
  ELSE
    PERFORM cron.schedule(
  'trial-reminder-email-hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/trial-reminder-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'trial_reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
  END IF;
END
$guard$;

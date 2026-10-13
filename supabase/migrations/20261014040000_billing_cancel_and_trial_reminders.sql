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

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Requires Vault secrets: 'project_url' (https://<ref>.supabase.co) and 'trial_reminder_cron_secret'
-- (same value as the edge function env TRIAL_REMINDER_CRON_SECRET).
select cron.schedule(
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

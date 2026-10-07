# Local live-schema replica (LOCAL ONLY — never point at live)

Rebuilds the live V2 schema in a throwaway Postgres 15+ cluster and verifies 0044.

```bash
# Cluster whose bootstrap superuser is NOT "postgres", so "postgres" can be a
# non-superuser migration owner exactly as on Supabase:
initdb -D /tmp/v2pg -U supabase_admin --auth=trust
pg_ctl -D /tmp/v2pg -o "-k /tmp -p 55434 -c listen_addresses=''" start
export PGHOST=/tmp PGPORT=55434 PGUSER=supabase_admin OWNER_ROLE=postgres

./replay.sh v2_live_replica                      # replay 57 live migrations in live order
psql -d v2_live_replica -f seed.sql              # 2 learners + 12 active questions (test data)
psql -U postgres -d v2_live_replica -f repro_live.sql   # reproduces the live failures
./replay.sh v2_verify --with-0044 --verify       # fresh replica + 0044 + two-user/anon checks
```

- `supabase_stub.sql` – minimal Supabase platform stub (roles, `auth.uid()/role()/jwt()`
  reading `request.jwt.claims`, default privileges in `public`).
- `repro_live.sql` – before 0044: save_attempt OK + observation written; rebuild fails on
  `pie_model_version_status_check`; `my_pie_state` → permission denied.
- `verify_0044.sql` – after 0044: flow, state_version increments, one row per learner,
  cross-user/anon/internal-function denial, observation-failure WARNING path, catalog checks.

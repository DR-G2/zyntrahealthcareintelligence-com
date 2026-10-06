create or replace view public.my_pie_state
with (security_invoker = true)
as
select distinct on (user_id)
  user_id,
  state_version,
  state,
  confidence,
  calculated_at,
  updated_at
from pie.pie_candidate_state
where user_id = auth.uid()
order by user_id, state_version desc;

revoke all on public.my_pie_state from anon, authenticated;
grant select on public.my_pie_state to authenticated;
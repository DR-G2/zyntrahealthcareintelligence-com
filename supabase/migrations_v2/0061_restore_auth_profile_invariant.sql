-- Restore the auth -> profile invariant required by V2 learner-owned tables.
-- practice_sessions.user_id and the PIE learner state all reference public.profiles(id).
-- A fresh V2 project was missing the legacy auth.users profile trigger, leaving
-- newly-created Auth users without their required profile row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Repair any Auth users that were created while the trigger was absent.
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

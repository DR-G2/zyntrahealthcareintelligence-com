-- 0036: pin trigger helper search_path
-- The trigger only references now(), but explicitly pinning the search_path
-- removes mutable-search-path risk without changing its behavior.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

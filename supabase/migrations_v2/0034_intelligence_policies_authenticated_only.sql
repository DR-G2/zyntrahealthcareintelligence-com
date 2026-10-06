do $$
declare r record;
begin
  for r in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname in ('intelligence','pie')
      and roles::text = '{public}'
  loop
    execute format('alter policy %I on %I.%I to authenticated',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;
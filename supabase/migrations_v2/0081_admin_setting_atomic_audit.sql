-- Atomically update an allowlisted site setting and write its audit record.
-- Called only by the authenticated admin-toggle-setting Edge Function using service_role.
create or replace function public.admin_update_site_setting_atomic(
  p_actor_user_id uuid,
  p_actor_role text,
  p_setting_key text,
  p_setting_value boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, command
as $$
declare
  v_before jsonb;
  v_saved public.site_settings%rowtype;
begin
  if p_actor_user_id is null or p_actor_role is null then
    raise exception 'Actor identity is required' using errcode = '22023';
  end if;

  if lower(p_actor_role) not in ('super_admin', 'super-admin') then
    raise exception 'Super administrator access required' using errcode = '42501';
  end if;

  if p_setting_key is null or p_setting_key not in (
    'show_about_pricing',
    'maintenance_mode',
    'registration_open',
    'osce_enabled',
    'mcq_temp_enabled'
  ) then
    raise exception 'Unsupported setting key' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'setting_key', setting_key,
    'setting_value', setting_value,
    'is_public', is_public,
    'updated_at', updated_at
  )
  into v_before
  from public.site_settings
  where setting_key = p_setting_key
  for update;

  insert into public.site_settings (
    setting_key, setting_value, is_public, updated_at
  ) values (
    p_setting_key,
    to_jsonb(p_setting_value),
    p_setting_key in ('show_about_pricing', 'registration_open'),
    now()
  )
  on conflict (setting_key) do update
    set setting_value = excluded.setting_value,
        is_public = excluded.is_public,
        updated_at = excluded.updated_at
  returning * into v_saved;

  insert into command.admin_activity_logs (
    actor_user_id, actor_role, action, target_type, target_id, reason,
    before_snapshot, after_snapshot
  ) values (
    p_actor_user_id, p_actor_role, 'site_setting_updated',
    'site_setting', p_setting_key, 'Command Centre feature setting change',
    coalesce(v_before, jsonb_build_object('setting_key', p_setting_key, 'setting_value', null)),
    jsonb_build_object(
      'setting_key', v_saved.setting_key,
      'setting_value', v_saved.setting_value,
      'is_public', v_saved.is_public,
      'updated_at', v_saved.updated_at
    )
  );

  return jsonb_build_object(
    'setting_key', v_saved.setting_key,
    'setting_value', v_saved.setting_value,
    'is_public', v_saved.is_public,
    'updated_at', v_saved.updated_at
  );
end;
$$;

revoke all on function public.admin_update_site_setting_atomic(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_update_site_setting_atomic(uuid, text, text, boolean) to service_role;

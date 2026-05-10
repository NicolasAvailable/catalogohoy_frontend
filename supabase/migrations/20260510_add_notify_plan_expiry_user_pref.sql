-- Per-user notification preferences. The owner of a paid catalog can opt
-- out of plan-expiry warnings from "Mi Perfil > Notificaciones". Default
-- is TRUE so existing rows get the safer behavior (always informed).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notify_plan_expiry BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.users.notify_plan_expiry IS
  'When true, the user receives email warnings before their tenant plan expires (6/4/2/0 days). Toggled from Mi Perfil > Notificaciones.';

-- Update the profile RPC so the frontend reads the preference along with
-- the rest of the user payload.
CREATE OR REPLACE FUNCTION public.get_my_profile_with_tenants()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_user_id int;
  v_user_email text;
begin
  select u.id, u.email
  into v_user_id, v_user_email
  from public.users u
  where u.auth_user_id = auth.uid();

  if v_user_id is null then
    raise exception 'User not found';
  end if;

  return jsonb_build_object(
    'user',
    (
      select jsonb_build_object(
        'id', u.id,
        'name', u.name,
        'email', u.email,
        'phone', u.phone,
        'photo', u.photo,
        'notify_plan_expiry', u.notify_plan_expiry
      )
      from public.users u
      where u.id = v_user_id
    ),

    'default_tenant',
    (
      select jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'slug', t.slug,
        'custom_domain', t.custom_domain,
        'role', ut.role
      )
      from public.users_tenants ut
      join public.tenants t on t.id = ut.tenant_id
      where ut.user_id = v_user_id
        and ut.is_default = true
      limit 1
    ),

    'tenants',
    (
      select jsonb_agg(row_data)
      from (
        select jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'slug', t.slug,
          'custom_domain', t.custom_domain,
          'role', ut.role,
          'is_default', ut.is_default
        ) as row_data
        from public.users_tenants ut
        join public.tenants t on t.id = ut.tenant_id
        where ut.user_id = v_user_id

        UNION ALL

        select jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'slug', t.slug,
          'custom_domain', t.custom_domain,
          'role', 'member',
          'is_default', false
        ) as row_data
        from public.team_members tm
        join public.teams te on te.id = tm.team_id
        join public.tenants t on t.id = te.tenant_id
        where tm.status = 'accepted'
          and (tm.user_id = v_user_id OR tm.invited_email = v_user_email)
          and not exists (
            select 1
            from public.users_tenants ut2
            where ut2.user_id = v_user_id
              and ut2.tenant_id = t.id
          )
      ) combined
    )
  );
end;
$function$;

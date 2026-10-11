-- Vista interna de Free Trials: lista los tenants en prueba de 7 días
-- (stripe_subscription_status = 'trialing'). Molde: list_paying_clients_admin
-- (20260811_internal_lists_search_pagination.sql). Gateado por _assert_internal_admin.

drop function if exists public.list_trialing_tenants_admin(text, integer, integer);

create function public.list_trialing_tenants_admin(
  p_search text default null,
  p_limit  integer default 1000,
  p_offset integer default 0
)
returns table(
  tenant_id bigint, tenant_name text, tenant_slug text, tenant_logo text,
  owner_name text, owner_email text, tier text,
  started_at timestamptz, expires_at timestamptz, days_until_expiry integer,
  country_code text, total_count bigint
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_term text := nullif(trim(coalesce(p_search, '')), '');
  v_like text := '%' || v_term || '%';
begin
  perform public._assert_internal_admin();

  return query
  with base as (
    select
      t.id                 as tenant_id,
      t.name               as tenant_name,
      t.slug               as tenant_slug,
      tec.logo             as tenant_logo,
      owner_data.name      as owner_name,
      owner_data.email     as owner_email,
      t.plan_id            as tier,
      t.plan_started_at    as started_at,
      t.plan_expires_at    as expires_at,
      case when t.plan_expires_at is null then null
           else ceil(extract(epoch from (t.plan_expires_at - now())) / 86400)::int
      end                  as days_until_expiry,
      t.country_code       as country_code
    from public.tenants t
    left join public.tenant_ecommerce_config tec on tec.tenant_id = t.id
    left join lateral (
      select
        trim(concat_ws(' ', u.name, u.last_name)) as name,
        u.email
      from public.users_tenants ut
      join public.users u on u.id = ut.user_id
      where ut.tenant_id = t.id
      order by ut.is_default desc nulls last, (ut.role = 'owner') desc, ut.id asc
      limit 1
    ) owner_data on true
    where t.stripe_subscription_status = 'trialing'
  )
  select b.tenant_id, b.tenant_name, b.tenant_slug, b.tenant_logo, b.owner_name,
         b.owner_email, b.tier, b.started_at, b.expires_at, b.days_until_expiry,
         b.country_code, count(*) over() as total_count
  from base b
  where v_term is null
     or b.tenant_name ilike v_like
     or b.tenant_slug ilike v_like
     or b.owner_name ilike v_like
     or b.owner_email ilike v_like
  order by b.expires_at asc nulls last
  limit  greatest(coalesce(p_limit, 1000), 0)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$fn$;

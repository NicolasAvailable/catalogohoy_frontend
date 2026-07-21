-- ═══════════════════════════════════════════════════════════════════════════
-- SWITCH DE PRICING: plan Pro $19.99 + Avanzado $29.99 + límite de órdenes
-- del plan Gratis (Linear CAT-32 / CAT-35)
--
-- ⚠️ EJECUTAR SOLO EN EL MOMENTO DEL SWITCH, coordinado con:
--   1. Precios creados en Stripe (CAT-33) → rellenar los __PRICE_*__ de abajo
--   2. Redeploy de supabase/functions/create-checkout-session (PRICE_MAP nuevo,
--      misma edición: los price IDs de ese archivo son los que REALMENTE cobran)
--   3. Deploy del commit "avanzado a 29.99" en la app (rama feat/plan-pro-switch)
--
-- Grandfathering: NO se toca tenants.plan_id de nadie. Los avanzado existentes
-- conservan ilimitado a $19.99 (Stripe ancla el precio viejo a sus subs; el
-- webhook solo extiende plan_expires_at en renovaciones).
--
-- Dry-run previo contra prod: envolver en BEGIN; ... ROLLBACK; (patrón habitual,
-- las branches de Supabase no son viables en este proyecto).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── 1) Límite mensual de órdenes por plan ──────────────────────────────────
-- 0 = ilimitado (mismo sentinela que max_products; ⚠️ NO aplica a max_catalogs).
alter table public.plans
  add column if not exists max_orders_month integer not null default 0;
comment on column public.plans.max_orders_month is
  'Máximo de órdenes por mes calendario. 0 = ilimitado (sentinela como max_products).';

update public.plans set max_orders_month = 25 where id = 'gratis';

-- ─── 2) Fila del plan Pro (position 2; corre avanzado→3 y enterprise→4) ─────
update public.plans set position = 4 where id = 'enterprise';
update public.plans set position = 3 where id = 'avanzado';

insert into public.plans (
  id, name, description, price, max_products, is_free, position,
  max_catalogs, max_team_members, max_variants, max_addons, max_orders_month,
  stripe_price_id_monthly, stripe_price_id_quarterly, stripe_price_id_annual
) values (
  'pro', 'Pro', 'Para tiendas grandes que venden todos los días.', 19.99, 500, false, 2,
  1, 2, 10, 10, 0,
  '__PRICE_PRO_MONTHLY__', '__PRICE_PRO_QUARTERLY__', '__PRICE_PRO_ANNUAL__'
);

-- ─── 3) Avanzado a $29.99 (solo compras nuevas) ─────────────────────────────
-- Nota: las columnas stripe_price_id_* de plans estaban DESACTUALIZADAS
-- (price_1T6Eg… vs los price_1TGfmg… que usa la edge function). Se actualizan
-- por higiene, pero la fuente de verdad del cobro sigue siendo el PRICE_MAP de
-- create-checkout-session.
update public.plans set
  price = 29.99,
  stripe_price_id_monthly   = '__PRICE_AVANZADO_MONTHLY__',
  stripe_price_id_quarterly = '__PRICE_AVANZADO_QUARTERLY__',
  stripe_price_id_annual    = '__PRICE_AVANZADO_ANNUAL__'
where id = 'avanzado';

-- ─── 4) Enforcement del límite de órdenes (trigger BEFORE INSERT) ───────────
-- Único choke point: cubre el checkout público (anon), el alta manual del admin
-- y cualquier camino futuro. La app mapea el mensaje 'order_limit_reached' a
-- textos amigables (storefront: checkout.ts · admin: order.service.ts).
create or replace function public.enforce_order_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_limit integer;
  v_count integer;
begin
  select p.max_orders_month into v_limit
  from tenants t
  join plans p on p.id = t.plan_id
  where t.id = new.tenant_id;

  -- Sin límite (0/null) o tenant sin plan → pasa.
  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  select count(*) into v_count
  from orders
  where tenant_id = new.tenant_id
    and created_at >= date_trunc('month', now());

  if v_count >= v_limit then
    raise exception 'order_limit_reached';
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_enforce_limit on public.orders;
create trigger orders_enforce_limit
  before insert on public.orders
  for each row execute function public.enforce_order_limit();

-- ─── 5) Créditos IA: pro = 350 (CASE compartido en 3 funciones) ─────────────
create or replace function public.ensure_ai_credits(p_user_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_allow integer;
begin
  if exists (select 1 from ai_credits where user_id = p_user_id) then return; end if;
  select coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'pro' then 350 when 'basico' then 200 else 15 end),15)
    into v_allow
  from users_tenants ut left join tenants t on t.id = ut.tenant_id
  where ut.user_id = p_user_id and ut.role='owner';
  insert into ai_credits(user_id, monthly_allowance, monthly_balance, reset_at)
  values (p_user_id, coalesce(v_allow,15), coalesce(v_allow,15), now()+interval '1 month')
  on conflict (user_id) do nothing;
end; $function$;

create or replace function public.reset_due_ai_credits()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_count integer;
begin
  with owner_allow as (
    select ut.user_id,
      coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'pro' then 350 when 'basico' then 200 else 15 end),15) as allowance
    from users_tenants ut left join tenants t on t.id=ut.tenant_id
    where ut.role='owner' group by ut.user_id
  )
  update ai_credits c
  set monthly_allowance = oa.allowance,
      monthly_balance = oa.allowance,
      reset_at = now() + interval '1 month',
      updated_at = now()
  from owner_allow oa
  where c.user_id = oa.user_id and c.reset_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end; $function$;

create or replace function public.sync_ai_credits_on_plan_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_allow integer;
begin
  for r in
    select ut.user_id from users_tenants ut
    where ut.tenant_id = NEW.id and ut.role = 'owner'
  loop
    perform public.ensure_ai_credits(r.user_id);
    select coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'pro' then 350 when 'basico' then 200 else 15 end), 15)
      into v_allow
    from users_tenants ut left join tenants t on t.id = ut.tenant_id
    where ut.user_id = r.user_id and ut.role = 'owner';
    update ai_credits c
    set monthly_balance = case
          when v_allow > c.monthly_allowance then greatest(c.monthly_balance, v_allow)
          else c.monthly_balance end,
        monthly_allowance = v_allow,
        updated_at = now()
    where c.user_id = r.user_id;
  end loop;
  return NEW;
exception when others then
  return NEW;
end; $function$;

commit;

-- ─── Verificación post-switch (correr aparte) ───────────────────────────────
-- select id, name, price, position, max_products, max_orders_month from plans order by position;
-- select tgname from pg_trigger where tgrelid = 'public.orders'::regclass and tgname = 'orders_enforce_limit';

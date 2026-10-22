-- Aislamiento entre tiendas (tenants): ningún catálogo puede leer ni cambiar
-- datos de otro. NO toca la lectura pública de `orders` (lectura_publica):
-- eso va en una migración aparte cuando Nicolas lo apruebe.
--
-- 1. Helper _is_service_or_member(): true para service_role / cron (postgres)
--    o para un miembro (users_tenants o team aceptado) del tenant.
-- 2. RPCs SECURITY DEFINER que recibían p_tenant_id sin verificar nada ahora
--    exigen membresía (se inyecta el guard en la definición actual).
-- 3. RPCs internas (cron / edge functions con service role) dejan de ser
--    ejecutables por anon/authenticated.
-- 4. product_categories: escrituras solo sobre productos del propio tenant.
-- 5. exchange_rates: un usuario ya no puede escribir valores arbitrarios.
-- 6. restore_order_backup: siempre restaura dentro del tenant del backup.
-- 7. tenants / tenant_ecommerce_config: USING del UPDATE = misma regla del CHECK.

-- 1 -------------------------------------------------------------------------
create or replace function public._is_service_or_member(p_tenant_id bigint)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin')
      or public._pos_can_access_tenant(p_tenant_id);
$$;
revoke execute on function public._is_service_or_member(bigint) from public, anon;
grant execute on function public._is_service_or_member(bigint) to authenticated, service_role;

-- 2 -------------------------------------------------------------------------
do $mig$
declare
  r record;
  v_def text;
  v_new text;
  v_guard constant text :=
    E'\nBEGIN\n  IF NOT public._is_service_or_member(p_tenant_id) THEN\n    RAISE EXCEPTION ''not_a_member'' USING ERRCODE = ''42501'';\n  END IF;\n';
begin
  -- plpgsql: guard justo después del BEGIN principal (columna 0).
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('update_ecommerce_config', 'update_tenant_name',
                        'decrement_product_stock', 'increment_product_stock',
                        'build_report_snapshot')
  loop
    v_def := pg_get_functiondef(r.oid);
    if position('_is_service_or_member' in v_def) > 0 then continue; end if;
    if position(E'\nBEGIN\n' in v_def) = 0 then
      raise exception 'no BEGIN found in %', r.proname;
    end if;
    v_new := regexp_replace(v_def, E'\nBEGIN\n', v_guard);
    execute v_new;
  end loop;

  -- sql: filtro extra en el WHERE (devuelve vacío si no es miembro).
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_customers_by_tenant', 'count_reports_this_month')
  loop
    v_def := pg_get_functiondef(r.oid);
    if position('_is_service_or_member' in v_def) > 0 then continue; end if;
    if r.proname = 'get_customers_by_tenant' then
      v_new := replace(v_def, 'where c.tenant_id = p_tenant_id',
        'where c.tenant_id = p_tenant_id and public._is_service_or_member(p_tenant_id)');
    else
      v_new := replace(v_def, 'WHERE tenant_id = p_tenant_id',
        'WHERE tenant_id = p_tenant_id AND public._is_service_or_member(p_tenant_id)');
    end if;
    if v_new = v_def then raise exception 'filter not injected in %', r.proname; end if;
    execute v_new;
  end loop;

  -- 6: restore_order_backup fuerza el tenant del backup en cada fila.
  select p.oid into r from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'restore_order_backup';
  v_def := pg_get_functiondef(r.oid);
  if position('to_jsonb(v_tenant_id)' in v_def) = 0 then
    v_new := replace(v_def,
      'jsonb_populate_record(null::public.orders, v_elem)',
      'jsonb_populate_record(null::public.orders, jsonb_set(v_elem, ''{tenant_id}'', to_jsonb(v_tenant_id)))');
    if v_new = v_def then raise exception 'restore_order_backup not patched'; end if;
    execute v_new;
  end if;
end
$mig$;

-- 3 -------------------------------------------------------------------------
-- Solo cron (postgres) y edge functions con service role. Las funciones que
-- se llaman desde otra SECURITY DEFINER corren como owner y no se afectan.
do $mig$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      '_apply_signup_whatsapp', '_seed_default_view_all_category',
      'activation_nudge_candidates', 'app_launch_candidates', 'apply_referral_reward',
      'check_expired_plans', 'customer_success_order_pending_candidates',
      'expire_stale_referrals', 'fetch_bcv_rates', 'ingest_ses_event',
      'maybe_enqueue_low_stock', 'plan_expiry_candidates', 'reset_due_ai_credits',
      'snapshot_mrr_monthly', 'weekly_report_candidates', 'weekly_report_extras',
      'weekly_report_recipients', 'bump_anon_quota', 'refund_anon_quota')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;

  -- Funciones *_admin: ya validan el email del admin; además, fuera de anon.
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname like '%\_admin'
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end
$mig$;

-- 4 -------------------------------------------------------------------------
-- ALTER (no DROP/CREATE) para que nunca haya un instante sin policy.
alter policy "Authenticated users can insert product categories" on public.product_categories
  with check (exists (
    select 1 from public.products p join public.categories c on c.id = product_categories.category_id
    where p.id = product_categories.product_id
      and c.tenant_id = p.tenant_id
      and public._pos_can_access_tenant(p.tenant_id)));
alter policy "Authenticated users can update product categories" on public.product_categories
  using (exists (
    select 1 from public.products p
    where p.id = product_categories.product_id and public._pos_can_access_tenant(p.tenant_id)))
  with check (exists (
    select 1 from public.products p join public.categories c on c.id = product_categories.category_id
    where p.id = product_categories.product_id
      and c.tenant_id = p.tenant_id
      and public._pos_can_access_tenant(p.tenant_id)));
alter policy "Authenticated users can delete product categories" on public.product_categories
  using (exists (
    select 1 from public.products p
    where p.id = product_categories.product_id and public._pos_can_access_tenant(p.tenant_id)));
alter policy "Authenticated users can insert product categories" on public.product_categories rename to product_categories_insert_tenant_members;
alter policy "Authenticated users can update product categories" on public.product_categories rename to product_categories_update_tenant_members;
alter policy "Authenticated users can delete product categories" on public.product_categories rename to product_categories_delete_tenant_members;

-- 5 -------------------------------------------------------------------------
-- El front (RateService) sincroniza bcv_usd/bcv_eur desde bcv_rates con un
-- UPDATE directo. Se mantiene funcionando, pero los valores siempre salen de
-- bcv_rates: un usuario no puede inyectar una tasa falsa para todas las tiendas.
create or replace function public.exchange_rates_guard_update()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare v_usd numeric; v_eur numeric;
begin
  if coalesce(auth.role(), '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  select usd, eur into v_usd, v_eur from public.bcv_rates order by fetched_at desc limit 1;
  new.id          := old.id;
  new.custom_rate := old.custom_rate;
  new.active_rate := old.active_rate;
  new.bcv_usd     := coalesce(v_usd, old.bcv_usd);
  new.bcv_eur     := coalesce(v_eur, old.bcv_eur);
  return new;
end;
$$;
revoke execute on function public.exchange_rates_guard_update() from public, anon, authenticated;

create trigger trg_exchange_rates_guard_update
  before update on public.exchange_rates
  for each row execute function public.exchange_rates_guard_update();

-- 7 -------------------------------------------------------------------------
alter policy tenants_update on public.tenants
  using (id in (select ut.tenant_id from public.users_tenants ut
                join public.users u on u.id = ut.user_id
                where u.auth_user_id = auth.uid()));

alter policy config_update on public.tenant_ecommerce_config
  using (tenant_id in (select ut.tenant_id from public.users_tenants ut
                       join public.users u on u.id = ut.user_id
                       where u.auth_user_id = auth.uid()));

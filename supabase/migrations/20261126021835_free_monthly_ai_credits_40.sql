CREATE OR REPLACE FUNCTION public.ensure_ai_credits(p_user_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_allow integer;
begin
  if exists (select 1 from ai_credits where user_id = p_user_id) then return; end if;
  select coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'pro' then 350 when 'basico' then 200 else 40 end),40)
    into v_allow
  from users_tenants ut left join tenants t on t.id = ut.tenant_id
  where ut.user_id = p_user_id and ut.role='owner';
  insert into ai_credits(user_id, monthly_allowance, monthly_balance, reset_at)
  values (p_user_id, coalesce(v_allow,40), coalesce(v_allow,40), now()+interval '1 month')
  on conflict (user_id) do nothing;
end; $function$;

CREATE OR REPLACE FUNCTION public.reset_due_ai_credits()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count integer;
begin
  with owner_allow as (
    select ut.user_id,
      coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'pro' then 350 when 'basico' then 200 else 40 end),40) as allowance
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

CREATE OR REPLACE FUNCTION public.sync_ai_credits_on_plan_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_allow integer;
begin
  for r in
    select ut.user_id from users_tenants ut
    where ut.tenant_id = NEW.id and ut.role = 'owner'
  loop
    perform public.ensure_ai_credits(r.user_id);
    select coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'pro' then 350 when 'basico' then 200 else 40 end), 40)
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

-- Preserve usage this cycle and any higher balance retained after a downgrade.
update public.ai_credits
set monthly_allowance = 40,
    monthly_balance = greatest(monthly_balance, least(monthly_balance + 25, 40)),
    updated_at = now()
where monthly_allowance = 15;

-- Captura trial_used_at la primera vez que un tenant entra en 'trialing'
-- (sin tocar la edge fn stripe-webhook, que es crítica) + embudo trial→pago.
create or replace function public.mark_trial_used()
returns trigger
language plpgsql
as $$
begin
  if new.stripe_subscription_status = 'trialing' and old.trial_used_at is null then
    new.trial_used_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mark_trial_used on public.tenants;
create trigger trg_mark_trial_used
  before update on public.tenants
  for each row
  when (new.stripe_subscription_status is distinct from old.stripe_subscription_status)
  execute function public.mark_trial_used();

-- Backfill: los que están en trial al aplicar quedan marcados (semilla del embudo).
update public.tenants
set trial_used_at = coalesce(trial_used_at, now())
where stripe_subscription_status = 'trialing' and trial_used_at is null;

-- Embudo de prueba gratis: iniciaron trial, siguen en trial, convirtieron a pago.
create or replace function public.trial_funnel_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started int;
  v_in_trial int;
  v_converted int;
begin
  perform _assert_internal_admin();

  select count(*)::int into v_started
  from tenants where trial_used_at is not null;

  select count(*)::int into v_in_trial
  from tenants where stripe_subscription_status = 'trialing';

  select count(*)::int into v_converted
  from tenants
  where trial_used_at is not null
    and stripe_subscription_status in ('active','past_due');

  return jsonb_build_object(
    'started', v_started,
    'inTrial', v_in_trial,
    'converted', v_converted,
    'conversionPct', case when v_started > 0
      then round((v_converted::numeric / v_started) * 100, 1) else 0 end
  );
end;
$$;

grant execute on function public.trial_funnel_admin() to authenticated;

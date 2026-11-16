-- Créditos de IA comprados dentro de las apps (App Store / Google Play) vía
-- RevenueCat. Lo escribe solo el `revenuecat-webhook` (service_role).
-- Idempotencia por id de transacción de la tienda: grant_iap_credits suma los
-- créditos SOLO si la fila es nueva (un reintento del webhook no duplica).

create table if not exists public.ai_credit_iap_purchases (
  id bigint generated always as identity primary key,
  store_transaction_id text not null unique,
  user_id bigint not null references public.users(id) on delete cascade,
  product_id text not null,
  credits integer not null check (credits > 0),
  store text not null,                 -- app_store | play_store
  environment text not null default 'PRODUCTION',
  price_usd numeric,
  currency text,
  revenuecat_event_id text,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_credit_iap_purchases_user_idx
  on public.ai_credit_iap_purchases (user_id);

-- Regla: tabla pública nueva => RLS en la misma migración. Sin policies:
-- solo service_role (webhook) la toca.
alter table public.ai_credit_iap_purchases enable row level security;

-- Acredita una compra in-app. Devuelve los créditos sumados (0 si ya estaba).
create or replace function public.grant_iap_credits(
  p_user_id bigint,
  p_transaction_id text,
  p_product_id text,
  p_credits integer,
  p_store text,
  p_environment text,
  p_price_usd numeric,
  p_currency text,
  p_event_id text
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id bigint;
begin
  insert into ai_credit_iap_purchases (
    store_transaction_id, user_id, product_id, credits, store,
    environment, price_usd, currency, revenuecat_event_id
  ) values (
    p_transaction_id, p_user_id, p_product_id, p_credits, p_store,
    coalesce(p_environment, 'PRODUCTION'), p_price_usd, p_currency, p_event_id
  )
  on conflict (store_transaction_id) do nothing
  returning id into v_id;

  if v_id is null then
    return 0;
  end if;

  perform public.add_purchased_credits(p_user_id, p_credits);
  return p_credits;
end; $$;

-- Reembolso de Apple/Google: resta esos créditos de la cubeta comprada (sin
-- bajar de 0). Idempotente por refunded_at. Devuelve los créditos restados.
create or replace function public.revoke_iap_credits(p_transaction_id text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user bigint;
  v_credits integer;
  v_removed integer;
begin
  update ai_credit_iap_purchases
     set refunded_at = now()
   where store_transaction_id = p_transaction_id
     and refunded_at is null
  returning user_id, credits into v_user, v_credits;

  if v_user is null then
    return 0;
  end if;

  update ai_credits
     set purchased_balance = greatest(purchased_balance - v_credits, 0),
         updated_at = now()
   where user_id = v_user
  returning v_credits into v_removed;

  return coalesce(v_removed, 0);
end; $$;

revoke all on function public.grant_iap_credits(bigint, text, text, integer, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.revoke_iap_credits(text) from public, anon, authenticated;
grant execute on function public.grant_iap_credits(bigint, text, text, integer, text, text, numeric, text, text) to service_role;
grant execute on function public.revoke_iap_credits(text) to service_role;

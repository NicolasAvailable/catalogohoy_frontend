-- IAP (RevenueCat) — compras in-app de planes en iOS.
-- El estado del plan sigue viviendo en las columnas existentes (plan_id,
-- plan_started_at, plan_expires_at, plan_expired); estas solo agregan
-- procedencia IAP para que el webhook de RevenueCat (revenuecat-webhook)
-- escriba igual que el stripe-webhook y la app las lea para el autoRenew.

alter table public.tenants
  add column if not exists revenuecat_app_user_id text,
  add column if not exists iap_store text,                 -- app_store | play_store
  add column if not exists iap_product_id text,            -- ch_pro_annual, etc.
  add column if not exists iap_subscription_status text;   -- active | billing_issue | cancelled | expired

-- Dedupe de eventos del webhook de RevenueCat (idempotencia): cada evento trae
-- un id único; si ya se procesó, se ignora.
create table if not exists public.iap_webhook_events (
  event_id   text primary key,
  event_type text,
  app_user_id text,
  tenant_id  bigint,
  received_at timestamptz not null default now()
);

-- Solo el service-role (la edge function) escribe acá; sin acceso público.
alter table public.iap_webhook_events enable row level security;

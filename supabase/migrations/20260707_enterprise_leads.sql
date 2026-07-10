-- Leads del funnel "Contactar ventas" del plan Enterprise (landing + admin).
-- Aplicada en prod el 2026-07-07 como create_enterprise_leads.
create table public.enterprise_leads (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  source          text not null check (source in ('landing','admin')),
  tenant_slug     text,
  business_name   text not null,
  country         text,
  website         text,
  name            text not null,
  email           text not null,
  phone           text,
  products_range  text not null,
  orders_range    text not null,
  catalogs_needed text not null,
  team_size       text not null,
  needs           text[] not null default '{}',
  score           int  not null,
  qualified       boolean not null,
  status          text not null default 'new'
                  check (status in ('new','contacted','demo_scheduled','won','lost')),
  answers         jsonb
);

-- RLS cerrada a propósito: CERO policies => anon/authenticated denegados.
-- Solo la edge function enterprise-lead (service role) escribe/lee.
alter table public.enterprise_leads enable row level security;

create index enterprise_leads_created_at_idx on public.enterprise_leads (created_at desc);
create index enterprise_leads_status_idx on public.enterprise_leads (status);

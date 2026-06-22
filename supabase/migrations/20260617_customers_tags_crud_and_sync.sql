-- Customers module: real `customers` table (source of truth for client identity)
-- + tags (labels) + N:N links, backfilled from orders and kept in sync via an
-- AFTER INSERT trigger. RLS per tenant (users_tenants membership). The list RPC
-- get_customers_by_tenant is rewritten to read from customers LEFT JOIN order
-- aggregates + tags, preserving all previously-returned fields.
--
-- Until now the "Clientes" section was read-only: clients were derived live from
-- orders (grouped by phone via get_customers_by_tenant). This introduces a real
-- entity so the merchant can add manually, edit, delete and tag clients, while
-- order-derived metrics (totals / counts) stay computed from orders.

-- ===== tables =====
create table public.customers (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  name text not null default 'Cliente',
  phone text not null,
  email text,
  birthday date,
  address text,
  notes text,
  referral_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_tenant_phone_unique unique (tenant_id, phone)
);
create index customers_tenant_idx on public.customers(tenant_id);

create table public.customer_tags (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);
create unique index customer_tags_tenant_name_idx on public.customer_tags(tenant_id, lower(name));

create table public.customer_tag_links (
  customer_id bigint not null references public.customers(id) on delete cascade,
  tag_id bigint not null references public.customer_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id)
);
create index customer_tag_links_tag_idx on public.customer_tag_links(tag_id);

-- ===== backfill from orders (latest name/email per tenant+phone) =====
insert into public.customers (tenant_id, name, phone, email, created_at)
select distinct on (o.tenant_id, btrim(o.phone))
  o.tenant_id,
  coalesce(nullif(btrim(o.name), ''), 'Cliente'),
  btrim(o.phone),
  nullif(btrim(o.email), ''),
  now()
from public.orders o
where o.phone is not null and btrim(o.phone) <> ''
order by o.tenant_id, btrim(o.phone), o.created_at desc
on conflict (tenant_id, phone) do nothing;

-- ===== keep customers in sync when new orders arrive =====
create or replace function public.sync_customer_from_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is null or btrim(new.phone) = '' then return new; end if;
  insert into public.customers (tenant_id, name, phone, email)
  values (new.tenant_id, coalesce(nullif(btrim(new.name), ''), 'Cliente'), btrim(new.phone), nullif(btrim(new.email), ''))
  on conflict (tenant_id, phone) do update
    set name = coalesce(nullif(btrim(excluded.name), ''), customers.name),
        email = coalesce(excluded.email, customers.email),
        updated_at = now();
  return new;
end; $$;

-- The trigger function is only ever invoked by the trigger (runs as table owner);
-- nobody should be able to call it directly.
revoke all on function public.sync_customer_from_order() from public, anon, authenticated;

drop trigger if exists trg_sync_customer_from_order on public.orders;
create trigger trg_sync_customer_from_order
  after insert on public.orders for each row execute function public.sync_customer_from_order();

-- ===== RLS (tenant member only) =====
alter table public.customers enable row level security;
alter table public.customer_tags enable row level security;
alter table public.customer_tag_links enable row level security;
revoke all on public.customers, public.customer_tags, public.customer_tag_links from anon;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.customer_tags to authenticated;
grant select, insert, update, delete on public.customer_tag_links to authenticated;

create policy customers_tenant_all on public.customers for all to authenticated
  using (exists (select 1 from public.users_tenants ut join public.users u on u.id = ut.user_id
                 where ut.tenant_id = customers.tenant_id and u.auth_user_id = auth.uid()))
  with check (exists (select 1 from public.users_tenants ut join public.users u on u.id = ut.user_id
                 where ut.tenant_id = customers.tenant_id and u.auth_user_id = auth.uid()));
create policy customer_tags_tenant_all on public.customer_tags for all to authenticated
  using (exists (select 1 from public.users_tenants ut join public.users u on u.id = ut.user_id
                 where ut.tenant_id = customer_tags.tenant_id and u.auth_user_id = auth.uid()))
  with check (exists (select 1 from public.users_tenants ut join public.users u on u.id = ut.user_id
                 where ut.tenant_id = customer_tags.tenant_id and u.auth_user_id = auth.uid()));
create policy customer_tag_links_tenant_all on public.customer_tag_links for all to authenticated
  using (exists (select 1 from public.customers c join public.users_tenants ut on ut.tenant_id = c.tenant_id
                 join public.users u on u.id = ut.user_id where c.id = customer_tag_links.customer_id and u.auth_user_id = auth.uid()))
  with check (exists (select 1 from public.customers c join public.users_tenants ut on ut.tenant_id = c.tenant_id
                 join public.users u on u.id = ut.user_id where c.id = customer_tag_links.customer_id and u.auth_user_id = auth.uid()));

-- ===== rewrite list RPC to read from customers + order aggregates + tags =====
drop function if exists public.get_customers_by_tenant(bigint);
create function public.get_customers_by_tenant(p_tenant_id bigint)
returns table(
  id bigint, phone text, name text, email text, birthday date,
  address text, notes text, referral_code text, tags jsonb,
  total_orders bigint, total_spent_usd numeric, total_spent_bs numeric,
  avg_order_usd numeric, first_order_at timestamptz, last_order_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    c.id, c.phone, c.name, c.email, c.birthday, c.address, c.notes, c.referral_code,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) order by t.name)
      from customer_tag_links l join customer_tags t on t.id = l.tag_id where l.customer_id = c.id
    ), '[]'::jsonb) as tags,
    coalesce(agg.total_orders, 0)::bigint as total_orders,
    coalesce(agg.total_spent_usd, 0) as total_spent_usd,
    coalesce(agg.total_spent_bs, 0) as total_spent_bs,
    coalesce(agg.avg_order_usd, 0) as avg_order_usd,
    agg.first_order_at,
    coalesce(agg.last_order_at, c.created_at) as last_order_at
  from customers c
  left join lateral (
    select count(*)::bigint as total_orders,
           coalesce(sum(o.total_usd),0) as total_spent_usd,
           coalesce(sum(o.total_bs),0) as total_spent_bs,
           coalesce(round(avg(o.total_usd),2),0) as avg_order_usd,
           min(o.created_at) as first_order_at, max(o.created_at) as last_order_at
    from orders o where o.tenant_id = c.tenant_id and btrim(o.phone) = c.phone
  ) agg on true
  where c.tenant_id = p_tenant_id
  order by coalesce(agg.last_order_at, c.created_at) desc;
$$;
revoke all on function public.get_customers_by_tenant(bigint) from public, anon;
grant execute on function public.get_customers_by_tenant(bigint) to authenticated;

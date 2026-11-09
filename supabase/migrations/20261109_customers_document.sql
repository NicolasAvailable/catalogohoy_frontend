-- Cédula/RIF del cliente + autollenado desde las órdenes (pedido Motofox/Saúl).
--
-- 1. customers.document: cédula, RIF o NIT del cliente (texto libre).
-- 2. sync_customer_from_order: además de nombre/email, copia orders.nit →
--    customers.document y orders.shipping_address → customers.address cuando
--    la orden los trae (nunca borra un dato existente con un vacío).
-- 3. get_customers_by_tenant devuelve `document` (cambia el RETURNS TABLE,
--    por eso drop + create; se reponen los grants).

alter table public.customers add column if not exists document text;

create or replace function public.sync_customer_from_order()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.phone is null or btrim(new.phone) = '' then return new; end if;
  insert into public.customers (tenant_id, name, phone, email, document, address)
  values (
    new.tenant_id,
    coalesce(nullif(btrim(new.name), ''), 'Cliente'),
    btrim(new.phone),
    nullif(btrim(new.email), ''),
    nullif(btrim(new.nit), ''),
    nullif(btrim(new.shipping_address), '')
  )
  on conflict (tenant_id, phone) do update
    set name = coalesce(nullif(btrim(excluded.name), ''), customers.name),
        email = coalesce(excluded.email, customers.email),
        document = coalesce(excluded.document, customers.document),
        address = coalesce(excluded.address, customers.address),
        updated_at = now();
  return new;
end; $function$;

drop function if exists public.get_customers_by_tenant(bigint);

create function public.get_customers_by_tenant(p_tenant_id bigint)
 returns table(id bigint, phone text, name text, nickname text, email text, birthday date, address text, notes text, referral_code text, document text, tags jsonb, total_orders bigint, total_spent_usd numeric, total_spent_bs numeric, avg_order_usd numeric, first_order_at timestamp with time zone, last_order_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    c.id, c.phone, c.name, c.nickname, c.email, c.birthday, c.address, c.notes, c.referral_code, c.document,
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
  where c.tenant_id = p_tenant_id and public._is_service_or_member(p_tenant_id)
  order by coalesce(agg.last_order_at, c.created_at) desc;
$function$;

grant execute on function public.get_customers_by_tenant(bigint) to anon, authenticated, service_role;

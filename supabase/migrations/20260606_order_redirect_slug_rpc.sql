-- W7 — Redirect del botón "Ver pedido" (catalogohoy.com/o/:id).
-- La landing (anónima) necesita resolver el slug del tenant de una orden para
-- redirigir a {slug}.catalogohoy.com/admin/orders/edit/{id}. Como `orders`
-- tiene RLS, exponemos sólo el slug (dato público) vía este RPC SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_order_redirect_slug(p_order_id BIGINT)
  RETURNS TEXT
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT t.slug
  FROM public.orders o
  JOIN public.tenants t ON t.id = o.tenant_id
  WHERE o.id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_redirect_slug(BIGINT) TO anon, authenticated;

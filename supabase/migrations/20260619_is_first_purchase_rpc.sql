-- RPC público para saber si un teléfono es cliente nuevo en el tenant.
-- Lo usa el checkout para habilitar las reglas de descuento 'first_purchase'.
-- SECURITY DEFINER + GRANT anon: no expone órdenes, solo devuelve un booleano.
CREATE OR REPLACE FUNCTION public.is_first_purchase(p_slug text, p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id bigint;
  v_digits    text;
  v_count     int;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = p_slug;
  IF v_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  v_digits := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  -- Sin un teléfono razonable no podemos identificar al cliente.
  IF length(v_digits) < 7 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.orders
  WHERE tenant_id = v_tenant_id
    AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_digits;

  RETURN v_count = 0;
END;
$$;

REVOKE ALL ON FUNCTION public.is_first_purchase(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_first_purchase(text, text) TO anon, authenticated;

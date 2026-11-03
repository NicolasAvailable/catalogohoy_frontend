-- Revalidación del carrito del catálogo público contra los datos actuales.
-- Los clientes guardan el carrito en localStorage y pueden comprar días
-- después: el precio, el stock o el producto pudieron cambiar. El frontend
-- revalida al abrir el carrito / checkout; este trigger es la red de seguridad
-- en el servidor al crear la orden (rechaza con 'cart_outdated').

-- Devuelve la lista de problemas de un carrito ([] = todo bien). Cada problema:
-- { index, productId, reason, available?, price? }
-- reason: removed | hidden | sold_out | variant_unavailable | size_unavailable
--         | addon_unavailable | stock | price
CREATE OR REPLACE FUNCTION public.public_cart_issues(p_tenant_id bigint, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues jsonb := '[]'::jsonb;
  v_item jsonb;
  v_idx int := -1;
  v_pid bigint;
  v_p products%ROWTYPE;
  v_variant jsonb;
  v_size jsonb;
  v_stock_raw text;
  v_stock numeric;
  v_qty_combo numeric;
  v_addons_total numeric;
  v_addon jsonb;
  v_found jsonb;
  v_price numeric;
  v_candidates numeric[];
  v_tier jsonb;
  v_ok boolean;
  v_c numeric;
  v_bad_addon boolean;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN v_issues;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_idx := v_idx + 1;
    -- Líneas sin productId (formatos viejos) no se pueden validar.
    IF COALESCE(v_item->>'productId', '') !~ '^\d+$' THEN
      CONTINUE;
    END IF;
    v_pid := (v_item->>'productId')::bigint;

    SELECT * INTO v_p FROM products WHERE id = v_pid AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN
      v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'removed');
      CONTINUE;
    END IF;
    IF COALESCE(v_p.is_hidden, false) THEN
      v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'hidden');
      CONTINUE;
    END IF;
    IF COALESCE(v_p.is_sold_out, false) THEN
      v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'sold_out', 'available', 0);
      CONTINUE;
    END IF;

    -- Variante / talla / stock que aplica a esta línea (igual que el carrito).
    v_variant := NULL;
    v_size := NULL;
    v_stock_raw := NULL;
    IF NULLIF(v_item->>'variantId', '') IS NOT NULL THEN
      SELECT v INTO v_variant FROM jsonb_array_elements(COALESCE(v_p.variants, '[]'::jsonb)) v
        WHERE v->>'id' = v_item->>'variantId' LIMIT 1;
      IF v_variant IS NULL OR COALESCE((v_variant->>'isHidden')::boolean, false) THEN
        v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'variant_unavailable');
        CONTINUE;
      END IF;
      IF NULLIF(v_item->>'size', '') IS NOT NULL AND jsonb_array_length(COALESCE(v_variant->'sizes', '[]'::jsonb)) > 0 THEN
        SELECT s INTO v_size FROM jsonb_array_elements(v_variant->'sizes') s WHERE s->>'name' = v_item->>'size' LIMIT 1;
        IF v_size IS NULL THEN
          v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'size_unavailable');
          CONTINUE;
        END IF;
        v_stock_raw := v_size->>'stock';
      ELSE
        v_stock_raw := v_variant->>'stock';
      END IF;
    ELSIF NULLIF(v_item->>'size', '') IS NOT NULL AND COALESCE(v_p.is_sized, false) THEN
      SELECT s INTO v_size FROM jsonb_array_elements(COALESCE(v_p.sizes, '[]'::jsonb)) s WHERE s->>'name' = v_item->>'size' LIMIT 1;
      IF v_size IS NULL THEN
        v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'size_unavailable');
        CONTINUE;
      END IF;
      v_stock_raw := v_size->>'stock';
    ELSE
      v_stock_raw := v_p.stock::text;
    END IF;

    -- Stock: suma de todas las líneas de la misma combinación producto+variante+talla.
    IF NULLIF(v_stock_raw, '') IS NOT NULL AND v_stock_raw ~ '^-?\d+(\.\d+)?$' THEN
      v_stock := v_stock_raw::numeric;
      SELECT COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0)), 0) INTO v_qty_combo
        FROM jsonb_array_elements(p_items) i
        WHERE i->>'productId' = v_item->>'productId'
          AND COALESCE(i->>'variantId', '') = COALESCE(v_item->>'variantId', '')
          AND COALESCE(i->>'size', '') = COALESCE(v_item->>'size', '');
      IF v_qty_combo > v_stock THEN
        v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid,
          'reason', CASE WHEN v_stock <= 0 THEN 'sold_out' ELSE 'stock' END,
          'available', GREATEST(v_stock, 0));
        CONTINUE;
      END IF;
    END IF;

    -- Adicionales: deben seguir existiendo; su precio actual suma al unitario.
    v_addons_total := 0;
    v_bad_addon := false;
    IF jsonb_typeof(v_item->'addons') = 'array' THEN
      FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item->'addons') LOOP
        SELECT a INTO v_found FROM jsonb_array_elements(COALESCE(v_p.addons, '[]'::jsonb)) a
          WHERE a->>'id' = v_addon->>'id' LIMIT 1;
        IF v_found IS NULL THEN
          v_bad_addon := true;
          EXIT;
        END IF;
        v_addons_total := v_addons_total + COALESCE(NULLIF(v_found->>'price', '')::numeric, 0);
      END LOOP;
    END IF;
    IF v_bad_addon THEN
      v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'addon_unavailable');
      CONTINUE;
    END IF;

    -- Precio: el unitario de la línea debe coincidir con algún precio vigente.
    IF NULLIF(v_item->>'tierTitle', '') IS NOT NULL THEN
      v_candidates := ARRAY[]::numeric[];
      FOR v_tier IN SELECT * FROM jsonb_array_elements(COALESCE(v_p.wholesale_tiers, '[]'::jsonb)) LOOP
        IF v_tier->>'title' = v_item->>'tierTitle' THEN
          v_candidates := v_candidates || COALESCE(NULLIF(v_tier->>'price', '')::numeric, 0);
        END IF;
      END LOOP;
      IF array_length(v_candidates, 1) IS NULL THEN
        v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'removed');
        CONTINUE;
      END IF;
    ELSIF v_variant IS NOT NULL THEN
      v_candidates := ARRAY[COALESCE(NULLIF(v_variant->>'price', '')::numeric, 0) + v_addons_total];
    ELSE
      v_candidates := ARRAY[COALESCE(v_p.price, 0) + v_addons_total];
      IF COALESCE(v_p.price_promotional, 0) > 0 THEN
        -- Promo normal: se cobra el promocional. Promo en divisas: se cobra el normal.
        v_candidates := ARRAY[v_p.price_promotional + v_addons_total] || v_candidates;
      END IF;
    END IF;

    v_price := COALESCE(NULLIF(v_item->>'price', '')::numeric, 0);
    v_ok := false;
    FOREACH v_c IN ARRAY v_candidates LOOP
      IF abs(v_c - v_price) <= 0.01 THEN
        v_ok := true;
        EXIT;
      END IF;
    END LOOP;
    IF NOT v_ok THEN
      v_issues := v_issues || jsonb_build_object('index', v_idx, 'productId', v_pid, 'reason', 'price', 'price', v_candidates[1]);
    END IF;
  END LOOP;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.public_cart_issues(bigint, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.public_cart_issues(bigint, jsonb) TO anon, authenticated, service_role;

-- Red de seguridad al crear órdenes del catálogo público. Solo aplica a
-- inserts del navegador (anon/authenticated); edge functions con service_role
-- y órdenes manual/pos no se tocan.
CREATE OR REPLACE FUNCTION public.validate_public_order_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues jsonb;
BEGIN
  IF NEW.source IS DISTINCT FROM 'public' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  v_issues := public.public_cart_issues(NEW.tenant_id, NEW.products::jsonb);
  IF jsonb_array_length(v_issues) > 0 THEN
    RAISE EXCEPTION 'cart_outdated' USING DETAIL = v_issues::text, ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_orders_validate_public_cart
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_public_order_cart();

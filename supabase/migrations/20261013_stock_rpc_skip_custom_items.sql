-- FIX: los ítems personalizados de una orden tienen productId '__custom__' (o
-- vacío). El `(v_item->>'productId')::BIGINT` reventaba con
-- "invalid input syntax for type bigint" y ABORTABA todo el descuento/reposición
-- de la orden → el inventario nunca se movía (reportado por Distribuidora Moto Fox,
-- t2421; afecta a cualquier tenant que use ítems personalizados).
-- Ahora esos ítems se SALTAN (no tienen stock que mover) y los productos reales
-- de la misma orden sí se descuentan/reponen.

CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_tenant_id bigint, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item JSONB; v_product_id BIGINT; v_quantity NUMERIC; v_size TEXT; v_variant_id TEXT;
  v_pid_text TEXT;
  v_row products%ROWTYPE; v_new_stock NUMERIC; v_sizes JSONB; v_variants JSONB;
  v_var_idx INT; v_var_sizes JSONB; v_size_idx INT; v_size_obj JSONB; v_size_stock NUMERIC;
  v_var_stock NUMERIC;
  v_updated INT := 0; v_skipped INT := 0;
  v_notify BOOLEAN; v_threshold INT; v_old NUMERIC;
BEGIN
  IF p_tenant_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_arguments';
  END IF;

  SELECT u.notify_low_stock, u.low_stock_threshold INTO v_notify, v_threshold
  FROM users_tenants ut JOIN users u ON u.id = ut.user_id
  WHERE ut.tenant_id = p_tenant_id AND ut.role = 'owner'
  LIMIT 1;
  IF NOT COALESCE(v_notify, false) THEN v_threshold := NULL; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid_text   := COALESCE(v_item->>'product_id', v_item->>'productId');
    v_quantity   := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    v_size       := NULLIF(v_item->>'size', '');
    v_variant_id := NULLIF(COALESCE(v_item->>'variant_id', v_item->>'variantId'), '');
    -- productId puede venir '__custom__' (ítem manual sin stock) o vacío: skip, NO reventar.
    IF v_pid_text IS NULL OR v_pid_text !~ '^\d+$' OR v_quantity <= 0 THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    v_product_id := v_pid_text::BIGINT;
    SELECT * INTO v_row FROM products WHERE id = v_product_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN v_skipped := v_skipped + 1; CONTINUE; END IF;

    IF v_variant_id IS NOT NULL AND v_size IS NOT NULL THEN
      v_variants := v_row.variants; v_var_idx := -1;
      FOR i IN 0 .. COALESCE(jsonb_array_length(v_variants), 0) - 1 LOOP
        IF (v_variants->i->>'id') = v_variant_id THEN v_var_idx := i; EXIT; END IF;
      END LOOP;
      IF v_var_idx >= 0 THEN
        v_var_sizes := v_variants->v_var_idx->'sizes'; v_size_idx := -1;
        FOR i IN 0 .. COALESCE(jsonb_array_length(v_var_sizes), 0) - 1 LOOP
          IF (v_var_sizes->i->>'name') = v_size THEN v_size_idx := i; EXIT; END IF;
        END LOOP;
        IF v_size_idx >= 0 THEN
          v_size_obj := v_var_sizes->v_size_idx;
          IF v_size_obj->'stock' IS NOT NULL AND jsonb_typeof(v_size_obj->'stock') <> 'null' THEN
            v_old := (v_size_obj->>'stock')::NUMERIC;
            v_size_stock := GREATEST(0, v_old - v_quantity);
            v_variants := jsonb_set(v_variants, ARRAY[v_var_idx::TEXT, 'sizes', v_size_idx::TEXT, 'stock'], to_jsonb(v_size_stock));
            UPDATE products SET variants = v_variants WHERE id = v_product_id;
            v_updated := v_updated + 1;
            PERFORM maybe_enqueue_low_stock(p_tenant_id, v_product_id, v_row.name, 'variant_size',
              COALESCE(v_variants->v_var_idx->>'name','') || ' · ' || v_size, v_old, v_size_stock, v_threshold);
          END IF;
        END IF;
      ELSE v_skipped := v_skipped + 1; END IF;
      CONTINUE;
    END IF;

    IF v_variant_id IS NOT NULL AND v_size IS NULL THEN
      v_variants := v_row.variants; v_var_idx := -1;
      FOR i IN 0 .. COALESCE(jsonb_array_length(v_variants), 0) - 1 LOOP
        IF (v_variants->i->>'id') = v_variant_id THEN v_var_idx := i; EXIT; END IF;
      END LOOP;
      IF v_var_idx >= 0
         AND v_variants->v_var_idx->'stock' IS NOT NULL
         AND jsonb_typeof(v_variants->v_var_idx->'stock') <> 'null' THEN
        v_old := (v_variants->v_var_idx->>'stock')::NUMERIC;
        v_var_stock := GREATEST(0, v_old - v_quantity);
        v_variants := jsonb_set(v_variants, ARRAY[v_var_idx::TEXT, 'stock'], to_jsonb(v_var_stock));
        UPDATE products SET variants = v_variants WHERE id = v_product_id;
        v_updated := v_updated + 1;
        PERFORM maybe_enqueue_low_stock(p_tenant_id, v_product_id, v_row.name, 'variant',
          COALESCE(v_variants->v_var_idx->>'name',''), v_old, v_var_stock, v_threshold);
        CONTINUE;
      END IF;
    END IF;

    IF v_row.is_sized AND v_size IS NOT NULL THEN
      v_sizes := v_row.sizes; v_size_idx := -1;
      FOR i IN 0 .. jsonb_array_length(v_sizes) - 1 LOOP
        IF (v_sizes->i->>'name') = v_size THEN v_size_idx := i; EXIT; END IF;
      END LOOP;
      IF v_size_idx >= 0 THEN
        v_size_obj := v_sizes->v_size_idx;
        IF v_size_obj->'stock' IS NOT NULL AND jsonb_typeof(v_size_obj->'stock') <> 'null' THEN
          v_old := (v_size_obj->>'stock')::NUMERIC;
          v_size_stock := GREATEST(0, v_old - v_quantity);
          v_sizes := jsonb_set(v_sizes, ARRAY[v_size_idx::TEXT, 'stock'], to_jsonb(v_size_stock));
          UPDATE products SET sizes = v_sizes WHERE id = v_product_id;
          v_updated := v_updated + 1;
          PERFORM maybe_enqueue_low_stock(p_tenant_id, v_product_id, v_row.name, 'size',
            v_size, v_old, v_size_stock, v_threshold);
        END IF;
      END IF;
      CONTINUE;
    END IF;

    IF v_row.stock IS NULL THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    v_old := v_row.stock;
    v_new_stock := GREATEST(0, v_old - v_quantity);
    UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
    v_updated := v_updated + 1;
    PERFORM maybe_enqueue_low_stock(p_tenant_id, v_product_id, v_row.name, 'product',
      NULL, v_old, v_new_stock, v_threshold);
  END LOOP;
  RETURN jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
END $function$;

CREATE OR REPLACE FUNCTION public.increment_product_stock(p_tenant_id bigint, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item JSONB; v_product_id BIGINT; v_quantity NUMERIC; v_size TEXT; v_variant_id TEXT;
  v_pid_text TEXT;
  v_row products%ROWTYPE; v_new_stock NUMERIC; v_sizes JSONB; v_variants JSONB;
  v_var_idx INT; v_var_sizes JSONB; v_size_idx INT; v_size_obj JSONB; v_size_stock NUMERIC;
  v_var_stock NUMERIC;
  v_updated INT := 0; v_skipped INT := 0;
BEGIN
  IF p_tenant_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_arguments';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid_text   := COALESCE(v_item->>'product_id', v_item->>'productId');
    v_quantity   := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    v_size       := NULLIF(v_item->>'size', '');
    v_variant_id := NULLIF(COALESCE(v_item->>'variant_id', v_item->>'variantId'), '');
    IF v_pid_text IS NULL OR v_pid_text !~ '^\d+$' OR v_quantity <= 0 THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    v_product_id := v_pid_text::BIGINT;
    SELECT * INTO v_row FROM products WHERE id = v_product_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN v_skipped := v_skipped + 1; CONTINUE; END IF;

    IF v_variant_id IS NOT NULL AND v_size IS NOT NULL THEN
      v_variants := v_row.variants; v_var_idx := -1;
      FOR i IN 0 .. COALESCE(jsonb_array_length(v_variants), 0) - 1 LOOP
        IF (v_variants->i->>'id') = v_variant_id THEN v_var_idx := i; EXIT; END IF;
      END LOOP;
      IF v_var_idx >= 0 THEN
        v_var_sizes := v_variants->v_var_idx->'sizes'; v_size_idx := -1;
        FOR i IN 0 .. COALESCE(jsonb_array_length(v_var_sizes), 0) - 1 LOOP
          IF (v_var_sizes->i->>'name') = v_size THEN v_size_idx := i; EXIT; END IF;
        END LOOP;
        IF v_size_idx >= 0 THEN
          v_size_obj := v_var_sizes->v_size_idx;
          IF v_size_obj->'stock' IS NOT NULL AND jsonb_typeof(v_size_obj->'stock') <> 'null' THEN
            v_size_stock := (v_size_obj->>'stock')::NUMERIC + v_quantity;
            v_variants := jsonb_set(v_variants, ARRAY[v_var_idx::TEXT, 'sizes', v_size_idx::TEXT, 'stock'], to_jsonb(v_size_stock));
            UPDATE products SET variants = v_variants WHERE id = v_product_id;
            v_updated := v_updated + 1;
          END IF;
        END IF;
      ELSE v_skipped := v_skipped + 1; END IF;
      CONTINUE;
    END IF;

    IF v_variant_id IS NOT NULL AND v_size IS NULL THEN
      v_variants := v_row.variants; v_var_idx := -1;
      FOR i IN 0 .. COALESCE(jsonb_array_length(v_variants), 0) - 1 LOOP
        IF (v_variants->i->>'id') = v_variant_id THEN v_var_idx := i; EXIT; END IF;
      END LOOP;
      IF v_var_idx >= 0
         AND v_variants->v_var_idx->'stock' IS NOT NULL
         AND jsonb_typeof(v_variants->v_var_idx->'stock') <> 'null' THEN
        v_var_stock := (v_variants->v_var_idx->>'stock')::NUMERIC + v_quantity;
        v_variants := jsonb_set(v_variants, ARRAY[v_var_idx::TEXT, 'stock'], to_jsonb(v_var_stock));
        UPDATE products SET variants = v_variants WHERE id = v_product_id;
        v_updated := v_updated + 1;
        CONTINUE;
      END IF;
    END IF;

    IF v_row.is_sized AND v_size IS NOT NULL THEN
      v_sizes := v_row.sizes; v_size_idx := -1;
      FOR i IN 0 .. jsonb_array_length(v_sizes) - 1 LOOP
        IF (v_sizes->i->>'name') = v_size THEN v_size_idx := i; EXIT; END IF;
      END LOOP;
      IF v_size_idx >= 0 THEN
        v_size_obj := v_sizes->v_size_idx;
        IF v_size_obj->'stock' IS NOT NULL AND jsonb_typeof(v_size_obj->'stock') <> 'null' THEN
          v_size_stock := (v_size_obj->>'stock')::NUMERIC + v_quantity;
          v_sizes := jsonb_set(v_sizes, ARRAY[v_size_idx::TEXT, 'stock'], to_jsonb(v_size_stock));
          UPDATE products SET sizes = v_sizes WHERE id = v_product_id;
          v_updated := v_updated + 1;
        END IF;
      END IF;
      CONTINUE;
    END IF;

    IF v_row.stock IS NULL THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    v_new_stock := v_row.stock + v_quantity;
    UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
    v_updated := v_updated + 1;
  END LOOP;
  RETURN jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
END $function$;

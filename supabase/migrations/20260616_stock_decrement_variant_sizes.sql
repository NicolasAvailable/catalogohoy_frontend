-- Stock decrement/increment now also handles sizes nested inside variants.
-- Order item shape: { productId, quantity, size, variantId }.
--   - variantId present -> products.variants[byId].sizes[byName].stock
--   - else is_sized      -> products.sizes[byName].stock  (Producto original)
--   - else               -> products.stock
-- A variant size and a base size with the same name are decremented
-- independently (the variantId disambiguates them).

CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_tenant_id bigint, p_items jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_item JSONB; v_product_id BIGINT; v_quantity NUMERIC; v_size TEXT; v_variant_id TEXT;
  v_row products%ROWTYPE; v_new_stock NUMERIC; v_sizes JSONB; v_variants JSONB;
  v_var_idx INT; v_var_sizes JSONB; v_size_idx INT; v_size_obj JSONB; v_size_stock NUMERIC;
  v_updated INT := 0; v_skipped INT := 0;
BEGIN
  IF p_tenant_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_arguments';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'product_id')::BIGINT, (v_item->>'productId')::BIGINT);
    v_quantity   := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    v_size       := NULLIF(v_item->>'size', '');
    v_variant_id := NULLIF(COALESCE(v_item->>'variant_id', v_item->>'variantId'), '');
    IF v_product_id IS NULL OR v_quantity <= 0 THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    SELECT * INTO v_row FROM products WHERE id = v_product_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN v_skipped := v_skipped + 1; CONTINUE; END IF;

    IF v_variant_id IS NOT NULL THEN
      v_variants := v_row.variants; v_var_idx := -1;
      FOR i IN 0 .. COALESCE(jsonb_array_length(v_variants), 0) - 1 LOOP
        IF (v_variants->i->>'id') = v_variant_id THEN v_var_idx := i; EXIT; END IF;
      END LOOP;
      IF v_var_idx >= 0 AND v_size IS NOT NULL THEN
        v_var_sizes := v_variants->v_var_idx->'sizes'; v_size_idx := -1;
        FOR i IN 0 .. COALESCE(jsonb_array_length(v_var_sizes), 0) - 1 LOOP
          IF (v_var_sizes->i->>'name') = v_size THEN v_size_idx := i; EXIT; END IF;
        END LOOP;
        IF v_size_idx >= 0 THEN
          v_size_obj := v_var_sizes->v_size_idx;
          IF v_size_obj->'stock' IS NOT NULL AND jsonb_typeof(v_size_obj->'stock') <> 'null' THEN
            v_size_stock := GREATEST(0, (v_size_obj->>'stock')::NUMERIC - v_quantity);
            v_variants := jsonb_set(v_variants, ARRAY[v_var_idx::TEXT, 'sizes', v_size_idx::TEXT, 'stock'], to_jsonb(v_size_stock));
            UPDATE products SET variants = v_variants WHERE id = v_product_id;
            v_updated := v_updated + 1;
          END IF;
        END IF;
      ELSE v_skipped := v_skipped + 1; END IF;
      CONTINUE;
    END IF;

    IF v_row.is_sized AND v_size IS NOT NULL THEN
      v_sizes := v_row.sizes; v_size_idx := -1;
      FOR i IN 0 .. jsonb_array_length(v_sizes) - 1 LOOP
        IF (v_sizes->i->>'name') = v_size THEN v_size_idx := i; EXIT; END IF;
      END LOOP;
      IF v_size_idx >= 0 THEN
        v_size_obj := v_sizes->v_size_idx;
        IF v_size_obj->'stock' IS NOT NULL AND jsonb_typeof(v_size_obj->'stock') <> 'null' THEN
          v_size_stock := GREATEST(0, (v_size_obj->>'stock')::NUMERIC - v_quantity);
          v_sizes := jsonb_set(v_sizes, ARRAY[v_size_idx::TEXT, 'stock'], to_jsonb(v_size_stock));
          UPDATE products SET sizes = v_sizes WHERE id = v_product_id;
          v_updated := v_updated + 1;
        END IF;
      END IF;
      CONTINUE;
    END IF;

    IF v_row.stock IS NULL THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    v_new_stock := GREATEST(0, v_row.stock - v_quantity);
    UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
    v_updated := v_updated + 1;
  END LOOP;
  RETURN jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
END $function$;


CREATE OR REPLACE FUNCTION public.increment_product_stock(p_tenant_id bigint, p_items jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_item JSONB; v_product_id BIGINT; v_quantity NUMERIC; v_size TEXT; v_variant_id TEXT;
  v_row products%ROWTYPE; v_new_stock NUMERIC; v_sizes JSONB; v_variants JSONB;
  v_var_idx INT; v_var_sizes JSONB; v_size_idx INT; v_size_obj JSONB; v_size_stock NUMERIC;
  v_updated INT := 0; v_skipped INT := 0;
BEGIN
  IF p_tenant_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_arguments';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'product_id')::BIGINT, (v_item->>'productId')::BIGINT);
    v_quantity   := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    v_size       := NULLIF(v_item->>'size', '');
    v_variant_id := NULLIF(COALESCE(v_item->>'variant_id', v_item->>'variantId'), '');
    IF v_product_id IS NULL OR v_quantity <= 0 THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    SELECT * INTO v_row FROM products WHERE id = v_product_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN v_skipped := v_skipped + 1; CONTINUE; END IF;

    IF v_variant_id IS NOT NULL THEN
      v_variants := v_row.variants; v_var_idx := -1;
      FOR i IN 0 .. COALESCE(jsonb_array_length(v_variants), 0) - 1 LOOP
        IF (v_variants->i->>'id') = v_variant_id THEN v_var_idx := i; EXIT; END IF;
      END LOOP;
      IF v_var_idx >= 0 AND v_size IS NOT NULL THEN
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

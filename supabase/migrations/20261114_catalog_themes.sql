-- Temas del editor de catálogos (CAT-103), administrados desde el panel
-- interno (Temas de catálogo). Antes vivían fijos en el frontend
-- (design-editor.config.ts → DESIGN_THEMES); ahora el editor de cada tienda
-- los lee de acá, así se pueden agregar temas nuevos sin desplegar.
--
-- Elegir un tema copia sus valores al `design.look` de la tienda, así que
-- editar o borrar un tema NO cambia catálogos ya guardados: solo cambia lo
-- que se ofrece en el editor desde ese momento.
--
-- RLS: lectura pública solo de los temas visibles (el editor y, a futuro, el
-- storefront los leen). Sin policies de escritura: todo cambio pasa por RPCs
-- SECURITY DEFINER gateadas con _assert_internal_admin().

CREATE TABLE public.catalog_themes (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  -- Color principal (botones, precios, pestaña activa) → themeColor.
  color text NOT NULL CHECK (color ~* '^#[0-9a-f]{6}$'),
  -- Valores que se copian a design.look (fondo, paleta, fuente, botones…).
  look jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(look) = 'object'),
  is_premium boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_themes_public_read ON public.catalog_themes
  FOR SELECT TO anon, authenticated
  USING (is_active);

GRANT SELECT ON public.catalog_themes TO anon, authenticated;

-- ── Admin: listar (incluye ocultos + cuántas tiendas lo usan) ───────────
CREATE FUNCTION public.list_catalog_themes_admin()
 RETURNS TABLE(
   id text, name text, color text, look jsonb,
   is_premium boolean, is_active boolean, sort_order integer,
   stores_using bigint, updated_at timestamptz
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  SELECT t.id, t.name, t.color, t.look, t.is_premium, t.is_active, t.sort_order,
         (SELECT count(*) FROM public.tenant_ecommerce_config c
           WHERE c.design->'look'->>'theme' = t.id) AS stores_using,
         t.updated_at
  FROM public.catalog_themes t
  ORDER BY t.sort_order ASC, t.created_at ASC;
END;
$function$;

-- ── Admin: crear / editar. p_is_new = true falla si el id ya existe. ─────
CREATE FUNCTION public.save_catalog_theme_admin(
  p_id text,
  p_name text,
  p_color text,
  p_look jsonb,
  p_is_premium boolean,
  p_is_active boolean,
  p_is_new boolean DEFAULT false
)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id text;
BEGIN
  PERFORM public._assert_internal_admin();

  IF p_is_new THEN
    IF EXISTS (SELECT 1 FROM public.catalog_themes WHERE catalog_themes.id = p_id) THEN
      RAISE EXCEPTION 'Ya existe un tema con el id %', p_id;
    END IF;
    INSERT INTO public.catalog_themes (id, name, color, look, is_premium, is_active, sort_order)
    VALUES (
      p_id, btrim(p_name), lower(p_color), COALESCE(p_look, '{}'::jsonb) - 'theme',
      COALESCE(p_is_premium, true), COALESCE(p_is_active, true),
      COALESCE((SELECT max(sort_order) + 1 FROM public.catalog_themes), 0)
    )
    RETURNING catalog_themes.id INTO v_id;
  ELSE
    UPDATE public.catalog_themes
    SET name = btrim(p_name),
        color = lower(p_color),
        look = COALESCE(p_look, '{}'::jsonb) - 'theme',
        is_premium = COALESCE(p_is_premium, true),
        is_active = COALESCE(p_is_active, true),
        updated_at = now()
    WHERE catalog_themes.id = p_id
    RETURNING catalog_themes.id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Tema % no encontrado', p_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

-- ── Admin: reordenar (lista completa de ids en el orden nuevo) ───────────
CREATE FUNCTION public.reorder_catalog_themes_admin(p_ids text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();

  UPDATE public.catalog_themes t
  SET sort_order = o.pos - 1, updated_at = now()
  FROM unnest(p_ids) WITH ORDINALITY AS o(id, pos)
  WHERE t.id = o.id;
END;
$function$;

-- ── Admin: borrar. Las tiendas que lo usaban conservan su diseño. ────────
CREATE FUNCTION public.delete_catalog_theme_admin(p_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();
  DELETE FROM public.catalog_themes WHERE catalog_themes.id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_catalog_themes_admin() FROM anon;
REVOKE ALL ON FUNCTION public.save_catalog_theme_admin(text, text, text, jsonb, boolean, boolean, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.reorder_catalog_themes_admin(text[]) FROM anon;
REVOKE ALL ON FUNCTION public.delete_catalog_theme_admin(text) FROM anon;

-- ── Semilla: los 12 temas que hoy están fijos en el editor ───────────────
-- (generado desde DESIGN_THEMES; "Claro" es el único gratis)
INSERT INTO public.catalog_themes (id, name, color, look, is_premium, is_active, sort_order) VALUES
  ('claro', 'Claro', '#4f46e5', '{"bgType":"fill","bgColor":"#ffffff","surfaceColor":"#ffffff","borderColor":"#e8e8ec","textColor":"#111827","mutedColor":"#6b7280","brutal":false,"font":"Inter","buttonShape":"rounded","buttonStyle":"solid","buttonSize":"md"}'::jsonb, false, true, 0),
  ('mineral', 'Mineral', '#1c1917', '{"bgType":"fill","bgColor":"#fbf3ea","surfaceColor":"#fffaf4","borderColor":"#eadccb","textColor":"#1c1917","mutedColor":"#78716c","brutal":false,"font":"Inter","buttonShape":"rounded","buttonStyle":"outline","buttonSize":"sm"}'::jsonb, true, true, 1),
  ('arena', 'Arena', '#9a5b25', '{"bgType":"fill","bgColor":"#f7f1e8","surfaceColor":"#fffdf9","borderColor":"#eadfcd","textColor":"#3a2a1a","mutedColor":"#86735c","brutal":false,"font":"Playfair Display","buttonShape":"pill","buttonStyle":"outline","buttonSize":"sm"}'::jsonb, true, true, 2),
  ('algodon', 'Algodón', '#9d2c6b', '{"bgType":"gradient","gradientFrom":"#e7a3d4","gradientVia":"","gradientTo":"#f5c9de","glassCards":true,"bgColor":"#efb6d9","surfaceColor":"#ffffff8c","borderColor":"#ffffffb3","textColor":"#3a0d27","mutedColor":"#7a3a5f","brutal":false,"font":"Playfair Display","buttonShape":"rounded","buttonStyle":"soft","buttonSize":"md"}'::jsonb, true, true, 3),
  ('atardecer', 'Atardecer', '#ffffff', '{"bgType":"gradient","gradientFrom":"#8b2e5a","gradientVia":"#d9573f","gradientTo":"#4f46e5","glassCards":true,"bgColor":"#8b2e5a","surfaceColor":"#ffffff1f","borderColor":"#ffffff40","textColor":"#ffffff","mutedColor":"#f3d6dc","brutal":false,"font":"Poppins","buttonShape":"pill","buttonStyle":"outline","buttonSize":"sm"}'::jsonb, true, true, 4),
  ('crepusculo', 'Crepúsculo', '#f0c3f4', '{"bgType":"gradient","gradientFrom":"#2f2a5e","gradientVia":"","gradientTo":"#8a4c9c","glassCards":true,"bgColor":"#2f2a5e","surfaceColor":"#ffffff1a","borderColor":"#ffffff33","textColor":"#f7f3ff","mutedColor":"#d3c6ea","brutal":false,"font":"Nunito","buttonShape":"pill","buttonStyle":"solid","buttonSize":"md"}'::jsonb, true, true, 5),
  ('electrico', 'Eléctrico', '#ffffff', '{"bgType":"gradient","gradientFrom":"#1d4ed8","gradientVia":"","gradientTo":"#c026d3","glassCards":true,"bgColor":"#1d4ed8","surfaceColor":"#ffffff1f","borderColor":"#ffffff40","textColor":"#ffffff","mutedColor":"#dbe4ff","brutal":false,"font":"Space Grotesk","buttonShape":"pill","buttonStyle":"solid","buttonSize":"sm"}'::jsonb, true, true, 6),
  ('bloque', 'Bloque', '#d35bd7', '{"bgType":"fill","bgColor":"#6d28d9","surfaceColor":"#8b3fe6","borderColor":"#111111","textColor":"#ffffff","mutedColor":"#eadcff","brutal":true,"font":"Space Grotesk","buttonShape":"square","buttonStyle":"solid","buttonSize":"md"}'::jsonb, true, true, 7),
  ('cuadricula', 'Cuadrícula', '#111111', '{"bgType":"pattern","pattern":"grid","bgColor":"#e6f4c4","surfaceColor":"#ffffff","borderColor":"#111111","textColor":"#111111","mutedColor":"#3f4a2a","brutal":true,"font":"Space Grotesk","buttonShape":"pill","buttonStyle":"outline","buttonSize":"md"}'::jsonb, true, true, 8),
  ('jade', 'Jade', '#c6f432', '{"bgType":"gradient","gradientFrom":"#0e3b3a","gradientVia":"#1f6f5c","gradientTo":"#2a8f7e","glassCards":true,"bgColor":"#0e3b3a","surfaceColor":"#0a2a2a99","borderColor":"#c6f43233","textColor":"#e9fbb0","mutedColor":"#a9d6c4","brutal":false,"font":"Playfair Display","buttonShape":"pill","buttonStyle":"solid","buttonSize":"md"}'::jsonb, true, true, 9),
  ('lago', 'Lago', '#38bdf8', '{"bgType":"fill","bgColor":"#0b1120","surfaceColor":"#111a2e","borderColor":"#1d2942","textColor":"#e6e9f2","mutedColor":"#8b98b0","brutal":false,"font":"Inter","buttonShape":"rounded","buttonStyle":"outline","buttonSize":"sm"}'::jsonb, true, true, 10),
  ('carbon', 'Carbón', '#f5f5f4', '{"bgType":"fill","bgColor":"#111110","surfaceColor":"#191918","borderColor":"#2a2a28","textColor":"#f5f5f4","mutedColor":"#a8a29e","brutal":false,"font":"Inter","buttonShape":"square","buttonStyle":"solid","buttonSize":"sm"}'::jsonb, true, true, 11)
ON CONFLICT (id) DO NOTHING;


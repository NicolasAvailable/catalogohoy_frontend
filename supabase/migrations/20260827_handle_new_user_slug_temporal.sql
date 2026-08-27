-- 2026-08-27 · Onboarding wizard (CAT-49): el signup ya no pide nombre de
-- tienda (se pide en el wizard /onboarding). handle_new_user ahora crea el
-- tenant SIEMPRE: si el metadata no trae store_name, usa el nombre "Mi tienda"
-- y un slug temporal único `tienda-XXXXXX` que el wizard renombra en el paso
-- Catálogo. El camino con store_name (signup viejo, aún en prod hasta
-- deployar la rama authentication) queda idéntico.
CREATE OR REPLACE FUNCTION public.handle_new_user(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_auth_user_id uuid;
  v_email        text;
  v_name         text;
  v_phone        text;
  v_photo        text;
  v_store_name   text;
  v_slug         text;
  v_user_db_id   bigint;
  v_tenant_id    bigint;
  v_country_code text;
  v_country      text;
BEGIN
  v_auth_user_id := (event->'user'->>'id')::uuid;
  v_email        := event->'user'->>'email';

  v_name := trim(COALESCE(
    event->'user'->'user_metadata'->>'name',
    event->'user'->'user_metadata'->>'display_name',
    split_part(v_email, '@', 1)
  ));

  v_phone := COALESCE(
    event->'user'->'user_metadata'->>'phone',
    event->'user'->'raw_user_meta_data'->>'phone',
    ''
  );

  v_photo := COALESCE(
    event->'user'->'user_metadata'->>'avatar_url',
    event->'user'->'user_metadata'->>'picture',
    NULL
  );

  v_store_name := trim(event->'user'->'user_metadata'->>'store_name');

  v_country_code := COALESCE(
    NULLIF(trim(event->'user'->'user_metadata'->>'store_country_code'), ''),
    'VE'
  );
  v_country := NULLIF(trim(event->'user'->'user_metadata'->>'store_country'), '');

  INSERT INTO public.users (auth_user_id, email, name, phone, photo)
  VALUES (v_auth_user_id, v_email, v_name, v_phone, v_photo)
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    name = EXCLUDED.name,
    photo = COALESCE(EXCLUDED.photo, public.users.photo),
    updated_at = now()
  RETURNING id INTO v_user_db_id;

  IF v_store_name IS NOT NULL AND v_store_name <> '' THEN
    -- Camino clásico: el signup mandó el nombre de la tienda.
    v_slug := lower(
      regexp_replace(
        translate(v_store_name, 'ÁÉÍÓÚáéíóúÑñ', 'AEIOUaeiouNn'),
        '[^a-zA-Z0-9]+', '-', 'g'
      )
    );
    v_slug := trim(BOTH '-' FROM v_slug);

    IF v_slug = '' THEN
      RAISE EXCEPTION 'El store_name no contiene caracteres válidos para generar slug';
    END IF;

    IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) THEN
      RAISE EXCEPTION 'El slug "%" ya está en uso', v_slug;
    END IF;
  ELSE
    -- Signup nuevo (sin nombre de tienda): tenant temporal que el wizard
    -- de onboarding renombra. Slug único tienda-XXXXXX.
    v_store_name := 'Mi tienda';
    LOOP
      v_slug := 'tienda-' || substr(md5(v_auth_user_id::text || clock_timestamp()::text), 1, 6);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug);
    END LOOP;
  END IF;

  INSERT INTO public.tenants (name, slug, country_code, country)
  VALUES (v_store_name, v_slug, v_country_code, v_country)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.users_tenants (user_id, tenant_id, role, is_default)
  VALUES (v_user_db_id, v_tenant_id, 'owner', true);

  PERFORM public._seed_default_view_all_category(v_tenant_id, v_auth_user_id);

  RETURN '{}'::jsonb;
END;
$function$;

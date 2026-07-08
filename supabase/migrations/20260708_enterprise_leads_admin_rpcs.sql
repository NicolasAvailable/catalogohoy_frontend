-- RPCs del panel interno para gestionar leads Enterprise (RLS de la tabla
-- está cerrada; estas funciones SECURITY DEFINER gatean con _assert_internal_admin).
-- Aplicada en prod el 2026-07-08 como enterprise_leads_admin_rpcs.
CREATE OR REPLACE FUNCTION public.list_enterprise_leads_admin()
 RETURNS TABLE(
   id bigint, created_at timestamptz, source text, tenant_slug text,
   business_name text, country text, website text, name text, email text,
   phone text, products_range text, orders_range text, catalogs_needed text,
   team_size text, needs text[], score int, qualified boolean, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();
  RETURN QUERY
  SELECT l.id, l.created_at, l.source, l.tenant_slug, l.business_name,
         l.country, l.website, l.name, l.email, l.phone, l.products_range,
         l.orders_range, l.catalogs_needed, l.team_size, l.needs, l.score,
         l.qualified, l.status
  FROM public.enterprise_leads l
  ORDER BY l.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_enterprise_lead_status_admin(p_id bigint, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();
  IF p_status NOT IN ('new','contacted','demo_scheduled','won','lost') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;
  UPDATE public.enterprise_leads SET status = p_status WHERE id = p_id;
END;
$function$;

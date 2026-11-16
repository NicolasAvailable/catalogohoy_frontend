-- "Lo nuevo en CatalogoHoy" en el Inicio del panel: último número de la
-- newsletter ya enviado (o enviándose). Solo títulos de las secciones y sus
-- ítems; la tabla sigue cerrada para anon/authenticated.
create or replace function public.newsletter_latest()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id,
    'kind', i.kind,
    'title', i.title,
    'period_start', i.period_start,
    'period_end', i.period_end,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'emoji', s->>'emoji',
        'title', s->>'title',
        'items', coalesce((select jsonb_agg(it->>'title') from jsonb_array_elements(s->'items') it), '[]'::jsonb)
      ))
      from jsonb_array_elements(i.sections) s
    ), '[]'::jsonb)
  )
  from public.newsletter_issues i
  where i.status in ('sending', 'sent')
  order by i.period_end desc, i.id desc
  limit 1;
$$;
revoke all on function public.newsletter_latest() from public, anon;
grant execute on function public.newsletter_latest() to authenticated;

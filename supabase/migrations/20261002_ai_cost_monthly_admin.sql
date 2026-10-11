-- Costo de IA en USD del mes en curso, estimado por feature según el proveedor
-- que usa cada una (fal.ai imágenes, LLM de texto, Whisper audio). Son costos
-- aprox por generación; el detalle por feature queda en el breakdown.
-- Alimenta el EBITDA del tablero interno /business-metrics.
create or replace function public.ai_cost_monthly_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_usd numeric;
  v_breakdown jsonb;
begin
  perform _assert_internal_admin();

  with cost as (
    select
      feature,
      count(*)::int as gens,
      count(*) * (case feature
        when 'image_remove_bg'   then 0.03   -- fal.ai quitar fondo
        when 'image_generate'    then 0.02   -- fal.ai generar imagen
        when 'image_edit'        then 0.03   -- fal.ai editar imagen
        when 'image-matcher'     then 0.01   -- matching por visión
        when 'improve_text'      then 0.002  -- LLM texto corto
        when 'chat-transcribe'   then 0.01   -- Whisper
        when 'chat-dictate'      then 0.01   -- Whisper
        when 'pdf-import'        then 0.05   -- Claude visión (lotes)
        when 'pdf-import-photos' then 0.05   -- Claude visión
        else 0.01 end) as usd
    from ai_usage_log
    where created_at >= date_trunc('month', now())
    group by feature
  )
  select
    round(coalesce(sum(usd), 0), 2),
    coalesce(jsonb_agg(jsonb_build_object(
      'feature', feature, 'generations', gens, 'usd', round(usd, 2)
    ) order by usd desc), '[]'::jsonb)
  into v_month_usd, v_breakdown
  from cost;

  return jsonb_build_object('monthUsd', v_month_usd, 'breakdown', v_breakdown);
end;
$$;

grant execute on function public.ai_cost_monthly_admin() to authenticated;

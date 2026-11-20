-- Plan gratis: el editor de catálogo (design.look) no guarda opciones premium.
--
-- El frontend ya las quita al guardar (stripNewPremiumOptions en
-- libs/catalogohoy/ecommerce-config/.../design-editor.config.ts). Este trigger
-- aplica la misma regla en la base de datos, por si alguien guarda sin pasar
-- por la app. Misma lógica que el frontend: si cambias una regla, cambia ambas.
--
-- Regla: si la tienda está en un plan gratis y el NUEVO design.look trae una
-- opción premium distinta de la que ya estaba guardada, esa opción vuelve a
-- su valor anterior. Lo que ya estaba guardado se respeta (una tienda que bajó
-- de plan conserva su diseño). Solo toca design->'look'; nada más de la fila.
-- Solo en UPDATE: al crear la fila no hay diseño anterior con qué comparar
-- (ej. copiar un catálogo) y no queremos borrar nada en ese caso.

create or replace function public.strip_premium_design_look()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_free boolean;
  v_new jsonb;
  v_old jsonb;
  v_key text;
  v_val jsonb;
  v_theme_keys text[] := array[
    'bgType','bgColor','gradientFrom','gradientVia','gradientTo','glassCards',
    'pattern','surfaceColor','borderColor','textColor','mutedColor','brutal',
    'font','buttonShape','buttonStyle','buttonSize'
  ];
  v_premium_keys text[] := array[
    'buttonStyle','buttonShape','buttonText','font','productLayout','cardStyle','categoryStyle'
  ];
begin
  v_new := new.design -> 'look';
  if v_new is null or jsonb_typeof(v_new) <> 'object' then
    return new;
  end if;
  v_old := case when tg_op = 'UPDATE' then old.design -> 'look' end;
  if v_old is null or jsonb_typeof(v_old) <> 'object' then
    v_old := '{}'::jsonb;
  end if;
  -- Sin cambios en el diseño: nada que revisar.
  if v_new = v_old then
    return new;
  end if;

  select coalesce(p.is_free, true) into v_is_free
  from tenants t left join plans p on p.id = t.plan_id
  where t.id = new.tenant_id;
  if not coalesce(v_is_free, false) then
    return new;
  end if;

  -- Tema premium nuevo: se deshace el tema y todo lo que el tema cambió.
  if coalesce(v_new ->> 'theme', 'claro') <> 'claro'
     and (v_new -> 'theme') is distinct from (v_old -> 'theme') then
    foreach v_key in array (v_theme_keys || 'theme'::text) loop
      if v_old ? v_key then
        v_new := jsonb_set(v_new, array[v_key], v_old -> v_key);
      else
        v_new := v_new - v_key;
      end if;
    end loop;
  end if;

  -- Opciones premium sueltas (mismas reglas que isPremiumLookOption).
  foreach v_key in array v_premium_keys loop
    v_val := v_new -> v_key;
    if v_val is null or v_val is not distinct from (v_old -> v_key) then
      continue;
    end if;
    if (v_key = 'buttonStyle'   and v_val <> '"solid"')
    or (v_key = 'buttonShape'   and v_val =  '"pill"')
    or (v_key = 'buttonText'    and v_val <> '"Agregar"')
    or (v_key = 'font'          and v_val <> '"Inter"')
    or (v_key = 'productLayout' and v_val =  '"list"')
    or (v_key = 'cardStyle'     and v_val <> '"filled"')
    or (v_key = 'categoryStyle' and v_val <> '"tabs"') then
      if v_old ? v_key then
        v_new := jsonb_set(v_new, array[v_key], v_old -> v_key);
      else
        v_new := v_new - v_key;
      end if;
    end if;
  end loop;

  -- Productos destacados: quitar se puede; agregar nuevos es premium.
  if jsonb_typeof(v_new -> 'featuredIds') = 'array' then
    v_new := jsonb_set(
      v_new, '{featuredIds}',
      coalesce((
        select jsonb_agg(e)
        from jsonb_array_elements(v_new -> 'featuredIds') e
        where coalesce(v_old -> 'featuredIds', '[]'::jsonb) @> jsonb_build_array(e)
      ), '[]'::jsonb)
    );
  end if;

  new.design := jsonb_set(new.design, '{look}', v_new);
  return new;
end;
$$;

drop trigger if exists trg_strip_premium_design_look on public.tenant_ecommerce_config;
create trigger trg_strip_premium_design_look
  before update of design on public.tenant_ecommerce_config
  for each row execute function public.strip_premium_design_look();

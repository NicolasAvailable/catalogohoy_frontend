-- Cuota diaria por IP para herramientas gratuitas públicas (lead-gen sin login),
-- ej. el quita-fondo (edge fn `remove-bg-free`). Controla costo de fal.ai y
-- abuso. Solo la escribe el service role desde la edge fn.
create table if not exists public.anon_tool_usage (
  ip text not null,
  tool text not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (ip, tool, day)
);

-- Incremento atómico. Devuelve cuántos usos quedan tras este; -1 si excede.
create or replace function public.bump_anon_quota(p_ip text, p_tool text, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into anon_tool_usage (ip, tool, day, count)
  values (p_ip, p_tool, current_date, 1)
  on conflict (ip, tool, day) do update
    set count = anon_tool_usage.count + 1
  returning count into v_count;

  if v_count > p_limit then
    update anon_tool_usage set count = count - 1
      where ip = p_ip and tool = p_tool and day = current_date;
    return -1;
  end if;
  return p_limit - v_count;
end;
$$;

-- Devuelve un uso (si la IA falló tras haber contado, no penalizamos al usuario).
create or replace function public.refund_anon_quota(p_ip text, p_tool text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update anon_tool_usage set count = greatest(count - 1, 0)
    where ip = p_ip and tool = p_tool and day = current_date;
end;
$$;

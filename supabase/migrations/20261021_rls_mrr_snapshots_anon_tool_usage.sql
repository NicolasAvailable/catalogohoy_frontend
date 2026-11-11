-- Estas tablas se crearon sin RLS (20261002). Solo se acceden vía funciones
-- security definer (dueño postgres, salta RLS) y el service role, así que
-- RLS sin políticas cierra el acceso directo de anon/authenticated sin romper nada.
alter table public.mrr_snapshots enable row level security;
alter table public.anon_tool_usage enable row level security;

-- =============================================================================
-- CAT-88 — Backfill Supabase Storage → S3/CloudFront (fase 2).
--
-- Cola de trabajo para la edge `storage-backfill`: una fila por objeto del
-- bucket `catalogohoy`. La edge reclama lotes (SKIP LOCKED), copia cada objeto
-- a S3 con la MISMA key y marca `done`. Re-ejecutable: `storage_backfill_seed()`
-- agrega los objetos nuevos que sigan cayendo en Supabase Storage.
--
-- La reescritura de URLs en la DB (supabase.co → cdn.catalogohoy.com) es un
-- paso aparte (`storage_backfill_rewrite_urls`), solo para keys ya copiadas.
-- =============================================================================

create table if not exists public.storage_backfill (
  key         text primary key,
  size        bigint,
  mimetype    text,
  status      text not null default 'pending'
              check (status in ('pending', 'copying', 'done', 'error')),
  attempts    int not null default 0,
  error       text,
  claimed_at  timestamptz,
  copied_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists storage_backfill_status_idx on public.storage_backfill (status);

alter table public.storage_backfill enable row level security;
-- Sin policies: solo service_role (la edge) la toca.

-- Secreto compartido cron → edge (el valor se carga a mano, no va en el repo).
create table if not exists public.storage_backfill_config (
  id     int primary key default 1 check (id = 1),
  secret text not null
);
alter table public.storage_backfill_config enable row level security;

create or replace function public.storage_backfill_seed()
returns int
language sql
security definer
set search_path = public, storage
as $$
  with ins as (
    insert into public.storage_backfill (key, size, mimetype)
    select o.name, (o.metadata->>'size')::bigint, o.metadata->>'mimetype'
    from storage.objects o
    where o.bucket_id = 'catalogohoy'
      and o.name not like '%/.emptyFolderPlaceholder'
    on conflict (key) do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

-- Reclama hasta p_limit filas pendientes (o 'copying' colgadas >10 min, o
-- 'error' con <3 intentos) y las marca 'copying'.
create or replace function public.storage_backfill_claim(p_limit int)
returns setof public.storage_backfill
language sql
security definer
set search_path = public
as $$
  update public.storage_backfill b
     set status = 'copying', claimed_at = now(), attempts = b.attempts + 1
   where b.key in (
     select key from public.storage_backfill
      where status = 'pending'
         or (status = 'copying' and claimed_at < now() - interval '10 minutes')
         or (status = 'error' and attempts < 3)
      order by key
      limit p_limit
      for update skip locked
   )
  returning b.*;
$$;

revoke all on function public.storage_backfill_seed() from public, anon, authenticated;
revoke all on function public.storage_backfill_claim(int) from public, anon, authenticated;
grant execute on function public.storage_backfill_seed() to service_role;
grant execute on function public.storage_backfill_claim(int) to service_role;

select public.storage_backfill_seed();

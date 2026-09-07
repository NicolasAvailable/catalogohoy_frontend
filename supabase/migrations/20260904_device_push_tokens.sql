-- Tokens de push por dispositivo para las apps móviles (Capacitor + FCM/APNs).
-- Los guarda el front (PushService) tras registrar el dispositivo; los lee la
-- edge fn `send-push-notification` (con service role, bypass RLS) para enviar.

create table if not exists public.device_push_tokens (
  id           bigint generated always as identity primary key,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  token        text not null unique,
  platform     text not null,            -- 'ios' | 'android'
  app_version  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_device_push_tokens_user
  on public.device_push_tokens (auth_user_id);

alter table public.device_push_tokens enable row level security;

-- Cada usuario gestiona SOLO sus propios tokens.
create policy "device_push_tokens_select_own" on public.device_push_tokens
  for select using (auth.uid() = auth_user_id);

create policy "device_push_tokens_insert_own" on public.device_push_tokens
  for insert with check (auth.uid() = auth_user_id);

create policy "device_push_tokens_update_own" on public.device_push_tokens
  for update using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "device_push_tokens_delete_own" on public.device_push_tokens
  for delete using (auth.uid() = auth_user_id);

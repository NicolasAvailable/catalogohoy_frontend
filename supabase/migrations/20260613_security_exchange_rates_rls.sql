-- Security advisor (ERROR/CRITICAL: rls_disabled_in_public): lock down
-- public.exchange_rates.
--
-- exchange_rates is a single global row (id=1) holding the official BCV USD/EUR
-- reference rates. It's read by the public catalog (anon) and the admin, and
-- updated by the admin "Tasas del día" sync (authenticated — RateService.syncBcvRates
-- in libs/catalogohoy/rate, triggered from rate.store).
--
-- It shipped with RLS OFF and full ALL grants to anon/authenticated, so anyone
-- (even unauthenticated) could update/delete/truncate the global rate. We lock
-- it down while preserving the read paths and the admin rate sync.
--
-- Note: TRUNCATE is NOT gated by RLS, so the dangerous grants must be revoked,
-- not merely left uncovered by policies.

-- 1) Tighten grants: only what the app needs (read for all, update for admins).
revoke all on public.exchange_rates from anon, authenticated;
grant select on public.exchange_rates to anon, authenticated;
grant update on public.exchange_rates to authenticated;

-- 2) Enable RLS + minimal policies.
alter table public.exchange_rates enable row level security;

create policy exchange_rates_public_read on public.exchange_rates
  for select to anon, authenticated using (true);

create policy exchange_rates_admin_update on public.exchange_rates
  for update to authenticated using (true) with check (true);

-- One row per (tenant, expiry, threshold) so the cron can be re-run idempotently.
-- The composite UNIQUE prevents duplicate emails: if the same tenant_id +
-- plan_expires_at + days_before tuple already exists, the cron's INSERT
-- silently no-ops and the email is not re-sent.
CREATE TABLE IF NOT EXISTS public.tenant_expiry_warnings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_expires_at TIMESTAMPTZ NOT NULL,
  days_before INT NOT NULL CHECK (days_before IN (0, 2, 4, 6)),
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, plan_expires_at, days_before)
);

COMMENT ON TABLE public.tenant_expiry_warnings IS
  'Audit log of plan-expiry warning emails. UNIQUE(tenant_id, plan_expires_at, days_before) gives idempotency for the daily cron.';

CREATE INDEX IF NOT EXISTS idx_tenant_expiry_warnings_tenant
  ON public.tenant_expiry_warnings(tenant_id);

ALTER TABLE public.tenant_expiry_warnings ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (used by the edge function) reads/writes.

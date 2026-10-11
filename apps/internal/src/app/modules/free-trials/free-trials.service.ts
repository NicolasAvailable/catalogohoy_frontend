import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { PlanTier } from '../shared/plan-cycle.model';

export interface FreeTrial {
  tenantId: number;
  tenantName: string | null;
  tenantSlug: string | null;
  tenantLogo: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  tier: PlanTier;
  /** Inicio del trial (plan_started_at). */
  startedAt: string | null;
  /** Fin del trial = primer cobro (plan_expires_at). */
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  countryCode: string | null;
}

interface TrialRow {
  tenant_id: number;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_logo: string | null;
  owner_name: string | null;
  owner_email: string | null;
  tier: PlanTier;
  started_at: string | null;
  expires_at: string | null;
  days_until_expiry: number | null;
  country_code: string | null;
}

@Injectable({ providedIn: 'root' })
export class FreeTrialsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Tenants actualmente en free trial (stripe_subscription_status = 'trialing'),
   *  ordenados por el que vence primero. Los trials son pocos → traemos todo. */
  async list(search: string | null = null): Promise<Either<Error, FreeTrial[]>> {
    const { data, error } = await this.client.rpc('list_trialing_tenants_admin', {
      p_search: search?.trim() || null,
      p_limit: 1000,
      p_offset: 0,
    });

    if (error) return E.left(new Error(error.message));

    const rows = (data as TrialRow[]) ?? [];
    return E.right(
      rows.map((r) => ({
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        tenantSlug: r.tenant_slug,
        tenantLogo: r.tenant_logo,
        ownerName: r.owner_name,
        ownerEmail: r.owner_email,
        tier: r.tier,
        startedAt: r.started_at,
        expiresAt: r.expires_at,
        daysUntilExpiry:
          r.days_until_expiry === null ? null : Number(r.days_until_expiry),
        countryCode: r.country_code ?? null,
      }))
    );
  }
}

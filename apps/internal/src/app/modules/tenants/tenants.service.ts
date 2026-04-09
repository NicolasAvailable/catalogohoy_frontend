import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { PlanCycle, PlanTier } from '../shared/plan-cycle.model';
import { Tenant } from './tenants.model';

interface TenantRow {
  id: number;
  name: string | null;
  slug: string | null;
  country_code: string | null;
  logo: string | null;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
  plan_id: PlanTier;
  plan_started_at: string;
  plan_expires_at: string | null;
  plan_expired: boolean;
  plan_cycle: PlanCycle | null;
}

@Injectable({ providedIn: 'root' })
export class TenantsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /**
   * Fetches every tenant (catálogo) along with its e-commerce logo,
   * primary owner and current plan. The plan is read directly from
   * `tenants.plan_id` / `plan_started_at` / `plan_expires_at`, which
   * is the source of truth shared with the public-facing app.
   */
  async list(): Promise<Either<Error, Tenant[]>> {
    const { data, error } = await this.client.rpc('list_all_tenants_admin');

    if (error) {
      return E.left(new Error(error.message));
    }

    const tenants: Tenant[] = ((data as TenantRow[]) ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      countryCode: row.country_code,
      logo: row.logo,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      createdAt: row.created_at,
      plan: {
        tier: row.plan_id,
        cycle: row.plan_cycle,
        startedAt: row.plan_started_at,
        expiresAt: row.plan_expires_at,
        expired: row.plan_expired,
      },
    }));

    return E.right(tenants);
  }

  async assignPlan(
    tenantId: number,
    tier: PlanTier,
    cycle: PlanCycle
  ): Promise<Either<Error, number>> {
    const { data, error } = await this.client.rpc('assign_tenant_plan_admin', {
      p_tenant_id: tenantId,
      p_tier: tier,
      p_cycle: cycle,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(data as number);
  }

  async removePlan(tenantId: number): Promise<Either<Error, void>> {
    const { error } = await this.client.rpc('remove_tenant_plan_admin', {
      p_tenant_id: tenantId,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}

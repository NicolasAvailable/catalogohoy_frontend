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
  total_count: number;
}

export interface TenantsQuery {
  search?: string | null;
  limit?: number;
  offset?: number;
}

/** Page of tenants + the server-side total that matches the search. */
export interface TenantsPage {
  rows: Tenant[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class TenantsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /**
   * Fetches a page of tenants (catálogos) matching an optional search term,
   * along with each one's e-commerce logo, primary owner and current plan.
   * The plan is read directly from `tenants.plan_id` / `plan_started_at` /
   * `plan_expires_at`, which is the source of truth shared with the
   * public-facing app.
   *
   * Search + pagination happen server-side in `list_all_tenants_admin`
   * (PostgREST caps responses at 1000 rows, so client-side filtering could
   * never see older tenants once the platform grew past that). Every row
   * carries `total_count` = rows matching the search before LIMIT/OFFSET.
   */
  async list(query: TenantsQuery = {}): Promise<Either<Error, TenantsPage>> {
    const { data, error } = await this.client.rpc('list_all_tenants_admin', {
      p_search: query.search?.trim() || null,
      p_limit: query.limit ?? 100,
      p_offset: query.offset ?? 0,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    const rows = (data as TenantRow[]) ?? [];
    const tenants: Tenant[] = rows.map((row) => ({
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

    return E.right({ rows: tenants, total: Number(rows[0]?.total_count ?? 0) });
  }

  async assignPlan(
    tenantId: number,
    tier: PlanTier,
    cycle: PlanCycle,
    amountUsd: number,
    consumeCreditUsd: number | null = null
  ): Promise<Either<Error, number>> {
    const { data, error } = await this.client.rpc('assign_tenant_plan_admin', {
      p_tenant_id: tenantId,
      p_tier: tier,
      p_cycle: cycle,
      p_amount_usd: amountUsd,
      p_consume_credit_usd: consumeCreditUsd,
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

  /** Banea (o desbanea) a todos los dueños del tenant via
   *  `set_tenant_owners_banned_admin`. Setea `auth.users.banned_until` para
   *  bloquear el login en cualquier subdominio. */
  async setOwnersBanned(
    tenantId: number,
    banned: boolean
  ): Promise<Either<Error, number>> {
    const { data, error } = await this.client.rpc(
      'set_tenant_owners_banned_admin',
      { p_tenant_id: tenantId, p_banned: banned }
    );

    if (error) {
      return E.left(new Error(error.message));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = Number((data as any)?.users_affected ?? 0);
    return E.right(count);
  }

  async isOwnersBanned(tenantId: number): Promise<Either<Error, boolean>> {
    const { data, error } = await this.client.rpc(
      'is_tenant_owners_banned_admin',
      { p_tenant_id: tenantId }
    );

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(Boolean(data));
  }

  /** Carga el contexto de referidos de un tenant para mostrar en el dialog
   *  de Asignar plan: si fue referido (+ por quién), y cuánto crédito tiene
   *  disponible para consumir al confirmar este pago. */
  async getReferralContext(tenantId: number): Promise<
    Either<Error, ReferralContext>
  > {
    const { data, error } = await this.client.rpc('get_tenant_referral_context', {
      p_tenant_id: tenantId,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (data ?? {}) as any;
    return E.right({
      creditAvailableUsd: Number(row.credit_available_usd ?? 0),
      creditUsedUsd: Number(row.credit_used_usd ?? 0),
      isReferred: Boolean(row.is_referred),
      referrerTenantId: row.referrer_tenant_id ?? null,
      referrerName: row.referrer_name ?? null,
      referrerSlug: row.referrer_slug ?? null,
      referralStatus: row.referral_status ?? null,
      referralCode: row.referral_code ?? null,
    });
  }
}

export interface ReferralContext {
  creditAvailableUsd: number;
  creditUsedUsd: number;
  isReferred: boolean;
  referrerTenantId: number | null;
  referrerName: string | null;
  referrerSlug: string | null;
  referralStatus: 'pending' | 'qualified' | 'rewarded' | 'expired' | null;
  referralCode: string | null;
}

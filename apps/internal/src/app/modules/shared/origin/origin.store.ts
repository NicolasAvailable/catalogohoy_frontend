import { Injectable, signal } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantOrigin } from './origin.model';

interface OriginRow {
  tenant_id: number;
  pay_source: TenantOrigin['paySource'];
  pay_status: string | null;
  manual_payment_method: string | null;
  signup_platform: TenantOrigin['signupPlatform'];
  signup_provider: string | null;
  signup_source: string | null;
  signup_medium: string | null;
  signup_campaign: string | null;
  owner_signup_at: string | null;
  referred_by_tenant_id: number | null;
  referred_by_name: string | null;
}

const CHUNK = 500;

/**
 * Caché del "origen" de cada catálogo (canal de pago + cómo llegó el dueño).
 * Las listas llaman `ensure(ids)` con los catálogos que muestran y leen
 * `origins()` — así no hace falta tocar los RPC de cada listado.
 */
@Injectable({ providedIn: 'root' })
export class OriginStore {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly inFlight = new Set<number>();

  readonly origins = signal<ReadonlyMap<number, TenantOrigin>>(new Map());

  get(tenantId: number): TenantOrigin | null {
    return this.origins().get(tenantId) ?? null;
  }

  /** Pide el origen de los ids que todavía no están en caché. */
  async ensure(tenantIds: number[], force = false): Promise<void> {
    const have = this.origins();
    const missing = [...new Set(tenantIds)].filter(
      (id) => (force || !have.has(id)) && !this.inFlight.has(id)
    );
    if (!missing.length) return;
    missing.forEach((id) => this.inFlight.add(id));

    try {
      for (let i = 0; i < missing.length; i += CHUNK) {
        const ids = missing.slice(i, i + CHUNK);
        const { data, error } = await this.client.rpc(
          'get_tenant_origins_admin',
          { p_tenant_ids: ids }
        );
        if (error) {
          // Silencioso: el origen es informativo y no debe romper la vista.
          console.warn('[origin]', error.message);
          return;
        }
        const next = new Map(this.origins());
        for (const r of (data as OriginRow[]) ?? []) {
          next.set(Number(r.tenant_id), {
            tenantId: Number(r.tenant_id),
            paySource: r.pay_source ?? null,
            payStatus: r.pay_status ?? null,
            manualPaymentMethod: r.manual_payment_method ?? null,
            signupPlatform: r.signup_platform ?? null,
            signupProvider: r.signup_provider ?? null,
            signupSource: r.signup_source ?? null,
            signupMedium: r.signup_medium ?? null,
            signupCampaign: r.signup_campaign ?? null,
            ownerSignupAt: r.owner_signup_at ?? null,
            referredByTenantId: r.referred_by_tenant_id ?? null,
            referredByName: r.referred_by_name ?? null,
          });
        }
        this.origins.set(next);
      }
    } finally {
      missing.forEach((id) => this.inFlight.delete(id));
    }
  }
}

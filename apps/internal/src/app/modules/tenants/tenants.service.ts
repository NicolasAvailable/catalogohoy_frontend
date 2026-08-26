import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { PlanCycle, PlanTier } from '../shared/plan-cycle.model';
import { StripeBilling, Tenant, TenantDetail } from './tenants.model';

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

  /**
   * Detalle completo de un catálogo en un solo round-trip
   * (`get_tenant_detail_admin`, jsonb): órdenes totales/por mes, checklist de
   * configuración inicial, historial de pagos + renovaciones, equipo, canales
   * conectados y actividad. Devuelve Left si el tenant no existe.
   */
  async getDetail(tenantId: number): Promise<Either<Error, TenantDetail>> {
    const { data, error } = await this.client.rpc('get_tenant_detail_admin', {
      p_tenant_id: tenantId,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = data as any;
    if (!raw?.tenant) {
      return E.left(new Error(`No existe el catálogo #${tenantId}`));
    }

    const detail: TenantDetail = {
      tenant: {
        id: raw.tenant.id,
        name: raw.tenant.name ?? null,
        slug: raw.tenant.slug ?? null,
        countryCode: raw.tenant.country_code ?? null,
        createdAt: raw.tenant.created_at,
        customDomain: raw.tenant.custom_domain ?? null,
        extraCatalogs: Number(raw.tenant.extra_catalogs ?? 0),
        logo: raw.tenant.logo ?? null,
        banner: raw.tenant.banner ?? null,
        description: raw.tenant.description ?? null,
        isVisible: Boolean(raw.tenant.is_visible),
        isAcceptingOrders: Boolean(raw.tenant.is_accepting_orders),
        currency: raw.tenant.currency ?? 'USD',
      },
      plan: {
        tier: (raw.plan?.tier ?? 'gratis') as PlanTier,
        cycle: (raw.plan?.cycle ?? null) as PlanCycle | null,
        startedAt: raw.plan?.started_at ?? null,
        expiresAt: raw.plan?.expires_at ?? null,
        expired: Boolean(raw.plan?.expired),
        previousPlanId: raw.plan?.previous_plan_id ?? null,
        stripeSubscriptionStatus:
          raw.plan?.stripe_subscription_status ?? null,
        stripeCustomerId: raw.plan?.stripe_customer_id ?? null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      members: ((raw.members ?? []) as any[]).map((m) => ({
        name: m.name ?? null,
        email: m.email ?? null,
        phone: m.phone ?? null,
        role: m.role ?? null,
        isDefault: Boolean(m.is_default),
        joinedAt: m.joined_at ?? null,
        avatarUrl: m.avatar_url ?? null,
      })),
      subscriptions: {
        paymentsCount: Number(raw.subscriptions?.payments_count ?? 0),
        renewals: Number(raw.subscriptions?.renewals ?? 0),
        totalPaidUsd: Number(raw.subscriptions?.total_paid_usd ?? 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        history: ((raw.subscriptions?.history ?? []) as any[]).map((h) => ({
          id: h.id,
          tier: h.tier,
          cycle: h.cycle ?? null,
          amountUsd: h.amount_usd === null ? null : Number(h.amount_usd),
          paymentMethod: h.payment_method ?? null,
          status: h.status,
          startedAt: h.started_at,
          expiresAt: h.expires_at ?? null,
        })),
      },
      orders: {
        total: Number(raw.orders?.total ?? 0),
        completed: Number(raw.orders?.completed ?? 0),
        pending: Number(raw.orders?.pending ?? 0),
        last30d: Number(raw.orders?.last_30d ?? 0),
        prev30d: Number(raw.orders?.prev_30d ?? 0),
        firstAt: raw.orders?.first_at ?? null,
        lastAt: raw.orders?.last_at ?? null,
        revenueTotal: Number(raw.orders?.revenue_total ?? 0),
        revenueCompleted: Number(raw.orders?.revenue_completed ?? 0),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ordersMonthly: ((raw.orders_monthly ?? []) as any[]).map((m) => ({
        month: m.month,
        count: Number(m.count ?? 0),
        revenue: Number(m.revenue ?? 0),
      })),
      checklist: {
        hasProduct: Boolean(raw.checklist?.has_product),
        customized: Boolean(raw.checklist?.customized),
        hasSellers: Boolean(raw.checklist?.has_sellers),
        notifyConfigured: Boolean(raw.checklist?.notify_configured),
      },
      counts: {
        products: Number(raw.counts?.products ?? 0),
        productsVisible: Number(raw.counts?.products_visible ?? 0),
        categories: Number(raw.counts?.categories ?? 0),
        customers: Number(raw.counts?.customers ?? 0),
        chats: Number(raw.counts?.chats ?? 0),
        teamMembers: Number(raw.counts?.team_members ?? 0),
      },
      chatsByChannel: (raw.chats_by_channel ?? {}) as Record<string, number>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channels: ((raw.channels ?? []) as any[]).map((c) => ({
        channel: c.channel,
        identity: c.identity ?? null,
        displayName: c.display_name ?? null,
        connectedAt: c.connected_at ?? null,
      })),
      activity: {
        lastProductAt: raw.activity?.last_product_at ?? null,
        lastChatAt: raw.activity?.last_chat_at ?? null,
      },
    };

    return E.right(detail);
  }

  /**
   * Historial REAL de Stripe del tenant (suscripciones + facturas pagadas)
   * vía la edge fn `tenant-stripe-history` (gateada a admin interno; la
   * secret key vive solo en el server). Stripe devuelve montos en cents y
   * fechas en epoch seconds — acá se normalizan a unidades e ISO.
   */
  async getStripeHistory(
    tenantId: number
  ): Promise<Either<Error, StripeBilling>> {
    const { data, error } = await this.client.functions.invoke<{
      error?: string;
      customerId: string | null;
      paidTotalUsd: number | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subscriptions: any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoices: any[];
    }>('tenant-stripe-history', { body: { tenantId } });

    if (error) {
      return E.left(new Error(error.message));
    }
    if (!data || data.error) {
      return E.left(new Error(data?.error ?? 'Sin respuesta de Stripe'));
    }

    const toIso = (epoch: number | null | undefined): string | null =>
      epoch ? new Date(epoch * 1000).toISOString() : null;

    return E.right({
      customerId: data.customerId,
      paidTotalUsd:
        data.paidTotalUsd === null || data.paidTotalUsd === undefined
          ? null
          : Number(data.paidTotalUsd) / 100,
      subscriptions: (data.subscriptions ?? []).map((s) => ({
        id: s.id,
        status: s.status,
        createdAt: toIso(s.created) ?? '',
        currentPeriodEnd: toIso(s.currentPeriodEnd),
        cancelAtPeriodEnd: Boolean(s.cancelAtPeriodEnd),
        canceledAt: toIso(s.canceledAt),
        planNickname: s.planNickname ?? null,
        interval: s.interval ?? null,
        amount: s.amount === null ? null : Number(s.amount) / 100,
        currency: s.currency ? String(s.currency).toUpperCase() : null,
      })),
      invoices: (data.invoices ?? []).map((i) => ({
        id: i.id,
        number: i.number ?? null,
        amountPaid: Number(i.amountPaid ?? 0) / 100,
        currency: String(i.currency ?? 'usd').toUpperCase(),
        createdAt: toIso(i.created) ?? '',
        description: i.description ?? null,
        hostedInvoiceUrl: i.hostedInvoiceUrl ?? null,
      })),
    });
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

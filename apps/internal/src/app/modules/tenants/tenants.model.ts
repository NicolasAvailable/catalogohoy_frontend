import { PlanCycle, PlanTier } from '../shared/plan-cycle.model';

export interface ActivePlan {
  tier: PlanTier;
  /** Cycle is read from the sidecar `tenant_subscriptions` row, may be null. */
  cycle: PlanCycle | null;
  startedAt: string;
  expiresAt: string | null;
  expired: boolean;
}

export interface Tenant {
  id: number;
  name: string | null;
  slug: string | null;
  countryCode: string | null;
  logo: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string;
  /** Current plan from `tenants.plan_id`. `gratis` ⇒ no active paid plan. */
  plan: ActivePlan;
}

// ---------------------------------------------------------------------------
// Detalle completo de un catálogo (RPC `get_tenant_detail_admin`)
// ---------------------------------------------------------------------------

export interface TenantDetailMember {
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  isDefault: boolean;
  joinedAt: string | null;
  avatarUrl: string | null;
}

export interface TenantSubscriptionEntry {
  id: number;
  tier: PlanTier;
  cycle: PlanCycle | null;
  amountUsd: number | null;
  paymentMethod: string | null;
  status: 'active' | 'expired' | 'cancelled';
  startedAt: string;
  expiresAt: string | null;
}

export interface TenantMonthlyOrders {
  /** `YYYY-MM` */
  month: string;
  count: number;
  revenue: number;
}

export interface TenantChannel {
  channel: string;
  identity: string | null;
  displayName: string | null;
  connectedAt: string | null;
}

export interface TenantDetail {
  tenant: {
    id: number;
    name: string | null;
    slug: string | null;
    countryCode: string | null;
    createdAt: string;
    customDomain: string | null;
    extraCatalogs: number;
    logo: string | null;
    banner: string | null;
    description: string | null;
    isVisible: boolean;
    isAcceptingOrders: boolean;
    currency: string;
  };
  plan: {
    tier: PlanTier;
    cycle: PlanCycle | null;
    startedAt: string | null;
    expiresAt: string | null;
    expired: boolean;
    previousPlanId: string | null;
    stripeSubscriptionStatus: string | null;
    /** Presente ⇒ el tenant tiene (o tuvo) billing por Stripe; habilita la
     *  carga lazy del historial real vía la edge fn `tenant-stripe-history`. */
    stripeCustomerId: string | null;
  };
  members: TenantDetailMember[];
  subscriptions: {
    /** Pagos registrados manualmente (tenant_subscriptions, sin cancelados).
     *  Las renovaciones de Stripe NO se registran acá — ver stripe status. */
    paymentsCount: number;
    renewals: number;
    totalPaidUsd: number;
    history: TenantSubscriptionEntry[];
  };
  orders: {
    total: number;
    completed: number;
    pending: number;
    last30d: number;
    prev30d: number;
    firstAt: string | null;
    lastAt: string | null;
    /** En la moneda del catálogo (`tenant.currency`). */
    revenueTotal: number;
    revenueCompleted: number;
  };
  ordersMonthly: TenantMonthlyOrders[];
  /** Mismos criterios que el checklist "primeros pasos" del Inicio. */
  checklist: {
    hasProduct: boolean;
    customized: boolean;
    hasSellers: boolean;
    notifyConfigured: boolean;
  };
  counts: {
    products: number;
    productsVisible: number;
    categories: number;
    customers: number;
    chats: number;
    teamMembers: number;
  };
  chatsByChannel: Record<string, number>;
  channels: TenantChannel[];
  activity: {
    lastProductAt: string | null;
    lastChatAt: string | null;
  };
}

// ---------------------------------------------------------------------------
// Historial real de Stripe (edge fn `tenant-stripe-history`)
// ---------------------------------------------------------------------------

export interface StripeSubscription {
  id: string;
  status: string;
  /** ISO date (convertida desde el epoch de Stripe). */
  createdAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  planNickname: string | null;
  interval: string | null;
  /** En unidades de la moneda (ya divididas las cents). */
  amount: number | null;
  currency: string | null;
}

export interface StripeInvoice {
  id: string;
  number: string | null;
  /** En unidades de la moneda (ya divididas las cents). */
  amountPaid: number;
  currency: string;
  createdAt: string;
  description: string | null;
  hostedInvoiceUrl: string | null;
}

export interface StripeBilling {
  customerId: string | null;
  /** Total BRUTO liquidado en USD (de los balance_transactions de Stripe).
   *  Con Adaptive Pricing las facturas se presentan en moneda local; este es
   *  el USD real que recibimos. null si no se pudo leer. */
  paidTotalUsd: number | null;
  subscriptions: StripeSubscription[];
  /** Solo facturas pagadas (amount_paid > 0), más recientes primero. */
  invoices: StripeInvoice[];
}

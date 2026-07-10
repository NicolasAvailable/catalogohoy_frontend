export type PlanCycle = 'monthly' | 'quarterly' | 'annual';

export interface PlanCycleOption {
  cycle: PlanCycle;
  label: string;
  description: string;
  months: number;
  badge?: string;
}

export const PLAN_CYCLES: PlanCycleOption[] = [
  {
    cycle: 'monthly',
    label: 'Mensual',
    description: 'Cobro cada mes',
    months: 1,
  },
  {
    cycle: 'quarterly',
    label: 'Trimestral',
    description: 'Cobro cada 3 meses',
    months: 3,
    badge: '5% OFF',
  },
  {
    cycle: 'annual',
    label: 'Anual',
    description: 'Cobro una vez al año',
    months: 12,
    badge: '15% OFF',
  },
];

/**
 * Plan tiers.
 *
 * `gratis` is the implicit default — tenants without an active subscription
 * are considered to be on the free plan, so it is *not* something that gets
 * stored in `tenant_subscriptions` and *not* something that can be assigned
 * from the dialog (use "Quitar plan" to revert to gratis instead).
 */
export type PlanTier = 'gratis' | 'basico' | 'avanzado' | 'enterprise';

export interface PlanTierOption {
  tier: PlanTier;
  label: string;
  description: string;
}

/** Tiers selectable from the assign-plan dialog (paid plans only). */
export const PLAN_TIERS: PlanTierOption[] = [
  {
    tier: 'basico',
    label: 'Básico',
    description: 'Catálogo básico con productos limitados',
  },
  {
    tier: 'avanzado',
    label: 'Avanzado',
    description: 'Productos ilimitados, dominio y analíticas',
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    description: 'Límites ampliados · precio a medida (vía ventas)',
  },
];

/** Display labels for *all* tiers, including the implicit `gratis`. */
export const TIER_LABELS: Record<PlanTier, string> = {
  gratis: 'Gratis',
  basico: 'Básico',
  avanzado: 'Avanzado',
  enterprise: 'Enterprise',
};

export const tierLabel = (tier: PlanTier | string): string =>
  TIER_LABELS[tier as PlanTier] ?? tier;

export const cycleLabel = (cycle: PlanCycle | string): string =>
  PLAN_CYCLES.find((c) => c.cycle === cycle)?.label ?? cycle;

/**
 * Canonical monthly list prices (USD) — must match `public.plans.price`.
 * Used only to suggest a default amount in the assign-plan dialog; the
 * operator can override the value before saving.
 */
export const TIER_MONTHLY_PRICE_USD: Record<Exclude<PlanTier, 'gratis'>, number> = {
  basico: 9.99,
  avanzado: 19.99,
  // Enterprise no tiene precio de lista: es un default sugerido que el
  // operador SIEMPRE debe ajustar al monto negociado del deal.
  enterprise: 99.99,
};

/** Discount applied to the list price for each billing cycle. */
const CYCLE_DISCOUNT: Record<PlanCycle, number> = {
  monthly: 0,
  quarterly: 0.05,
  annual: 0.15,
};

/**
 * Suggested total amount charged for a full billing cycle — list price ×
 * months × (1 − discount), rounded to 2 decimals.
 */
export const defaultAmountUsd = (tier: PlanTier, cycle: PlanCycle): number => {
  if (tier === 'gratis') return 0;
  const months = PLAN_CYCLES.find((c) => c.cycle === cycle)?.months ?? 1;
  const gross = TIER_MONTHLY_PRICE_USD[tier] * months;
  const net = gross * (1 - CYCLE_DISCOUNT[cycle]);
  return Math.round(net * 100) / 100;
};

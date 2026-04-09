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
export type PlanTier = 'gratis' | 'basico' | 'avanzado';

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
];

/** Display labels for *all* tiers, including the implicit `gratis`. */
export const TIER_LABELS: Record<PlanTier, string> = {
  gratis: 'Gratis',
  basico: 'Básico',
  avanzado: 'Avanzado',
};

export const tierLabel = (tier: PlanTier | string): string =>
  TIER_LABELS[tier as PlanTier] ?? tier;

export const cycleLabel = (cycle: PlanCycle | string): string =>
  PLAN_CYCLES.find((c) => c.cycle === cycle)?.label ?? cycle;

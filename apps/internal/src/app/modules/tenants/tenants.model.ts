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

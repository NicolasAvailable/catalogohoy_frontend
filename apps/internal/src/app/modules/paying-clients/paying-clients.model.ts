import { PlanCycle, PlanTier } from '../shared/plan-cycle.model';

export interface PayingClient {
  tenantId: number;
  tenantName: string | null;
  tenantSlug: string | null;
  tenantLogo: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerAvatarUrl: string | null;
  tier: PlanTier;
  /** Cycle is nullable when reading directly from `tenants.plan_id`. */
  cycle: PlanCycle | null;
  startedAt: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  countryCode: string | null;
  /** Raw Stripe subscription status from `tenants`; null for manual plans. */
  stripeSubscriptionStatus: string | null;
}

export type PayingClientStatus = 'active' | 'expiring' | 'expired' | 'grace';

export const computeStatus = (
  daysUntilExpiry: number | null,
  stripeSubscriptionStatus?: string | null
): PayingClientStatus => {
  // Grace period: the renewal already extended plan_expires_at (the webhook
  // treats past_due as valid) but Stripe is still retrying the charge, so by
  // dates alone these clients would look "active".
  if (stripeSubscriptionStatus === 'past_due') return 'grace';
  if (daysUntilExpiry === null) return 'active';
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 7) return 'expiring';
  return 'active';
};

export interface SubscriptionHistoryEntry {
  id: number;
  tier: PlanTier;
  cycle: PlanCycle;
  amountUsd: number | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  status: 'active' | 'expired' | 'cancelled';
  startedAt: string;
  expiresAt: string | null;
  createdAt: string;
}

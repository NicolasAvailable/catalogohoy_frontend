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
}

export type PayingClientStatus = 'active' | 'expiring' | 'expired';

export const computeStatus = (
  daysUntilExpiry: number | null
): PayingClientStatus => {
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

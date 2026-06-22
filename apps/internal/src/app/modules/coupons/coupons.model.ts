export interface CouponProductPrice {
  id: string;
  nickname: string | null;
  unitAmount: number; // cents
  currency: string;
  interval: 'month' | 'year' | null;
  intervalCount: number | null;
}

export interface CouponProduct {
  id: string;
  name: string;
  planId: string | null;
  prices: CouponProductPrice[];
}

export interface PromotionCodeRow {
  id: string;
  code: string;
  active: boolean;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: number | null;
  minimumAmount: number | null;
  coupon: {
    id: string;
    name: string | null;
    percentOff: number | null;
    amountOff: number | null;
    duration: string;
    durationInMonths: number | null;
  };
}

export interface CreateCouponInput {
  productId: string;
  percentOff?: number;
  amountOff?: number; // cents
  duration: 'once' | 'forever' | 'repeating';
  durationInMonths?: number;
  name?: string;
  code?: string;
  minimumAmount?: number; // cents — pins the code to a modality
  maxRedemptions?: number;
  expiresAt?: number; // unix seconds
}

/** Human label for a price's billing interval. */
export function intervalLabel(p: CouponProductPrice): string {
  if (p.interval === 'year') return 'Anual';
  if (p.interval === 'month' && p.intervalCount === 3) return 'Trimestral';
  if (p.interval === 'month') return 'Mensual';
  return p.nickname ?? p.id;
}

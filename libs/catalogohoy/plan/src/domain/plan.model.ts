export interface PlanFeature {
  text: string;
  /** When true the feature renders with an `x` (unsupported/absent).
   *  Used for plan cards to show what a plan *doesn't* include. */
  negative?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  maxProducts: number;
  maxCatalogs: number;
  maxTeamMembers: number;
  /** Max variants allowed per product on this plan (gratis 1, basico 3, avanzado 15). */
  maxVariants: number;
  isFree: boolean;
  position: number;
}

export interface PlanDisplay extends Plan {
  period: string;
  maxProductsLabel: string;
  teamMembersLabel: string;
  rateType: string;
  features: PlanFeature[];
  additionalCatalogPrice: string;
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
  isCurrent: boolean;
  color: string;
}

export interface TenantPlanUsage {
  plan: Plan;
  currentProductCount: number;
  canCreateProduct: boolean;
  remainingProducts: number;
  currentCatalogCount: number;
  canCreateCatalog: boolean;
  remainingCatalogs: number;
  extraCatalogs: number;
  planExpired: boolean;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  /** True when the tenant has (or had) a Stripe subscription — used to route
   *  the expired-plan dialog to a Stripe checkout instead of WhatsApp. */
  hasStripeSubscription: boolean;
  /** True cuando la suscripción Stripe está `active`: Stripe cobra la
   *  renovación solo, así que no corresponde pedir renovación manual (eso
   *  aplica únicamente a los planes sin Stripe, p. ej. pago móvil VE). */
  autoRenews: boolean;
}

export interface TenantPlanExpiration {
  planStartedAt: string | null;
  planExpiresAt: string | null;
  planExpired: boolean;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
}

export interface TenantPlanPublicInfo {
  planExpired: boolean;
  isFreePlan: boolean;
}

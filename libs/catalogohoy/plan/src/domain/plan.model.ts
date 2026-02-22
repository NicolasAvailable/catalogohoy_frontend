export interface PlanFeature {
  text: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  maxProducts: number;
  isFree: boolean;
  position: number;
}

export interface PlanDisplay extends Plan {
  period: string;
  maxProductsLabel: string;
  rateType: string;
  features: PlanFeature[];
  additionalCatalogPrice: string;
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
}

export interface TenantPlanUsage {
  plan: Plan;
  currentProductCount: number;
  canCreateProduct: boolean;
  remainingProducts: number;
  planExpired: boolean;
  planExpiresAt: string | null;
}

export interface TenantPlanExpiration {
  planStartedAt: string | null;
  planExpiresAt: string | null;
  planExpired: boolean;
}

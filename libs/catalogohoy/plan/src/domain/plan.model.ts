export interface PlanFeature {
  text: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  maxProducts: number;
  maxCatalogs: number;
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
  planExpired: boolean;
  planExpiresAt: string | null;
}

export interface TenantPlanExpiration {
  planStartedAt: string | null;
  planExpiresAt: string | null;
  planExpired: boolean;
}

export interface TenantPlanPublicInfo {
  planExpired: boolean;
  isFreePlan: boolean;
}

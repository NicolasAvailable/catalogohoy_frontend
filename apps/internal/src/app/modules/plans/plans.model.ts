export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  maxProducts: number;
  maxCatalogs: number;
  maxTeamMembers: number | null;
  isFree: boolean;
  position: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdQuarterly: string | null;
  stripePriceIdAnnual: string | null;
  updatedAt: string;
}

export interface PlanUpdate {
  name?: string;
  description?: string | null;
  price?: number;
  maxProducts?: number;
  maxCatalogs?: number;
  maxTeamMembers?: number | null;
  position?: number;
  stripePriceIdMonthly?: string | null;
  stripePriceIdQuarterly?: string | null;
  stripePriceIdAnnual?: string | null;
}

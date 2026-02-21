export interface PlanFeature {
  text: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
  maxProducts: string;
  rateType: string;
  features: PlanFeature[];
  additionalCatalogPrice: string;
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
  isFree: boolean;
}

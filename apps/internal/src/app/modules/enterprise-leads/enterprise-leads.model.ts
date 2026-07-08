export type EnterpriseLeadStatus =
  | 'new'
  | 'contacted'
  | 'demo_scheduled'
  | 'won'
  | 'lost';

export interface EnterpriseLead {
  id: number;
  createdAt: string;
  source: 'landing' | 'admin';
  tenantSlug: string | null;
  businessName: string;
  country: string | null;
  website: string | null;
  name: string;
  email: string;
  phone: string | null;
  productsRange: string;
  ordersRange: string;
  catalogsNeeded: string;
  teamSize: string;
  needs: string[];
  score: number;
  qualified: boolean;
  status: EnterpriseLeadStatus;
}

export const LEAD_STATUS_OPTIONS: {
  value: EnterpriseLeadStatus;
  label: string;
}[] = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'demo_scheduled', label: 'Demo agendada' },
  { value: 'won', label: 'Ganado' },
  { value: 'lost', label: 'Perdido' },
];

export const statusLabel = (status: EnterpriseLeadStatus): string =>
  LEAD_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;

// Labels de las respuestas del funnel — mismos valores que la edge function
// enterprise-lead y el dialog del admin.
const RANGE_LABELS: Record<string, string> = {
  lt_100: 'Menos de 100',
  '100_500': '100 – 500',
  '500_2000': '500 – 2.000',
  gt_2000: 'Más de 2.000',
};

const CATALOG_LABELS: Record<string, string> = {
  '1': '1',
  '2_3': '2 – 3',
  '4_10': '4 – 10',
  gt_10: 'Más de 10',
};

const TEAM_LABELS: Record<string, string> = {
  solo: 'Solo el dueño',
  '2_5': '2 – 5',
  '6_15': '6 – 15',
  gt_15: 'Más de 15',
};

const NEED_LABELS: Record<string, string> = {
  multi_catalogs: 'Varios catálogos',
  big_team: 'Equipo grande',
  migration: 'Migración de datos',
  api_integrations: 'API / integraciones',
  custom_domain: 'Dominio propio',
  dedicated_support: 'Soporte dedicado',
  centralized_billing: 'Facturación centralizada',
  other: 'Otro',
};

export const rangeLabel = (value: string): string =>
  RANGE_LABELS[value] ?? value;
export const catalogsLabel = (value: string): string =>
  CATALOG_LABELS[value] ?? value;
export const teamLabel = (value: string): string => TEAM_LABELS[value] ?? value;
export const needsLabel = (needs: string[]): string =>
  needs.map((n) => NEED_LABELS[n] ?? n).join(', ') || '—';

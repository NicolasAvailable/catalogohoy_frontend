import { E } from '@shared/domain';

/** Id de la fila enterprise en la tabla `plans`. Se filtra del grid de cards
 *  (se renderiza como banda aparte) y no tiene checkout self-service. */
export const ENTERPRISE_PLAN_ID = 'enterprise';

/** Link de agenda de ventas. Cambiarlo acá actualiza toda la app (la landing
 *  tiene su propia copia en apps/landing/src/lib/enterprise-lead.ts). */
export const CALENDLY_ENTERPRISE_URL =
  'https://calendly.com/nicolas-catalogohoy/enterprise-catalogohoy';

export type EnterpriseRange = 'lt_100' | '100_500' | '500_2000' | 'gt_2000';
export type EnterpriseCatalogs = '1' | '2_3' | '4_10' | 'gt_10';
export type EnterpriseTeamSize = 'solo' | '2_5' | '6_15' | 'gt_15';
export type EnterpriseNeed =
  | 'multi_catalogs'
  | 'big_team'
  | 'migration'
  | 'api_integrations'
  | 'custom_domain'
  | 'dedicated_support'
  | 'centralized_billing'
  | 'other';

export interface EnterpriseFunnelAnswers {
  businessName: string;
  country: string;
  website: string;
  productsRange: EnterpriseRange;
  ordersRange: EnterpriseRange;
  catalogsNeeded: EnterpriseCatalogs;
  teamSize: EnterpriseTeamSize;
  needs: EnterpriseNeed[];
  name: string;
  email: string;
  phone: string;
}

export interface EnterpriseOption<T extends string> {
  value: T;
  label: string;
}

export const ENTERPRISE_RANGE_OPTIONS: EnterpriseOption<EnterpriseRange>[] = [
  { value: 'lt_100', label: 'Menos de 100' },
  { value: '100_500', label: '100 – 500' },
  { value: '500_2000', label: '500 – 2.000' },
  { value: 'gt_2000', label: 'Más de 2.000' },
];

export const ENTERPRISE_CATALOG_OPTIONS: EnterpriseOption<EnterpriseCatalogs>[] = [
  { value: '1', label: '1 catálogo' },
  { value: '2_3', label: '2 – 3' },
  { value: '4_10', label: '4 – 10' },
  { value: 'gt_10', label: 'Más de 10' },
];

export const ENTERPRISE_TEAM_OPTIONS: EnterpriseOption<EnterpriseTeamSize>[] = [
  { value: 'solo', label: 'Solo yo' },
  { value: '2_5', label: '2 – 5 personas' },
  { value: '6_15', label: '6 – 15 personas' },
  { value: 'gt_15', label: 'Más de 15' },
];

export const ENTERPRISE_NEED_OPTIONS: (EnterpriseOption<EnterpriseNeed> & {
  icon: string;
})[] = [
  { value: 'multi_catalogs', label: 'Varios catálogos', icon: 'layout-grid' },
  { value: 'big_team', label: 'Equipo grande', icon: 'users' },
  { value: 'migration', label: 'Migración de datos', icon: 'database' },
  { value: 'api_integrations', label: 'API / integraciones', icon: 'plug' },
  { value: 'custom_domain', label: 'Dominio propio', icon: 'globe' },
  { value: 'dedicated_support', label: 'Soporte dedicado', icon: 'headset' },
  { value: 'centralized_billing', label: 'Facturación centralizada', icon: 'receipt' },
  { value: 'other', label: 'Otro', icon: 'circle-ellipsis' },
];

export interface EnterpriseLeadResult {
  qualified: boolean;
  score: number;
}

/**
 * Filtro suave del funnel: puntúa las respuestas y decide si el lead ve el
 * calendario de ventas (calificado) o la recomendación del plan Avanzado.
 * Avanzado ya cubre productos ilimitados, 2 catálogos (+add-ons) y equipo de
 * 10 — las señales enterprise son >3 catálogos, equipo >15, API/integraciones
 * y volumen masivo.
 *
 * DEBE mantenerse en sync con la copia de la edge function `enterprise-lead`
 * (fuente de verdad de lo persistido) y la de la landing
 * (apps/landing/src/lib/enterprise-lead.ts).
 */
export function scoreEnterpriseLead(
  a: Pick<
    EnterpriseFunnelAnswers,
    'catalogsNeeded' | 'teamSize' | 'productsRange' | 'ordersRange' | 'needs'
  >
): EnterpriseLeadResult {
  let score = 0;
  score += { '1': 0, '2_3': 1, '4_10': 4, gt_10: 5 }[a.catalogsNeeded];
  score += { solo: 0, '2_5': 0, '6_15': 2, gt_15: 3 }[a.teamSize];
  score += { lt_100: 0, '100_500': 0, '500_2000': 1, gt_2000: 2 }[a.productsRange];
  score += { lt_100: 0, '100_500': 0, '500_2000': 1, gt_2000: 2 }[a.ordersRange];

  const needPoints: Record<EnterpriseNeed, number> = {
    api_integrations: 2,
    migration: 1,
    dedicated_support: 1,
    centralized_billing: 1,
    multi_catalogs: 1,
    big_team: 1,
    custom_domain: 0,
    other: 0,
  };
  score += Math.min(
    4,
    a.needs.reduce((acc, need) => acc + (needPoints[need] ?? 0), 0)
  );

  return { score, qualified: score >= 4 };
}

export function buildCalendlyUrl(name: string, email: string): string {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (email) params.set('email', email);
  const query = params.toString();
  return query ? `${CALENDLY_ENTERPRISE_URL}?${query}` : CALENDLY_ENTERPRISE_URL;
}

export interface EnterpriseLeadPayload {
  source: 'admin';
  tenantSlug: string | null;
  answers: EnterpriseFunnelAnswers;
}

export abstract class BaseEnterpriseLeadService {
  abstract submit(
    payload: EnterpriseLeadPayload
  ): Promise<E.Either<Error, EnterpriseLeadResult>>;
}

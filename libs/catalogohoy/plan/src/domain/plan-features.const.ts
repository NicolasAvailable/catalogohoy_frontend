import { PlanFeature } from './plan.model';

/** Features que promete cada plan — única fuente de verdad, la consumen la
 *  página de planes (cards) y la sección "Tu plan incluye" de Mi Perfil.
 *  Los textos son keys de transloco (KEY-AS-TEXT). */
export const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  gratis: [
    { text: '1 catálogo' },
    { text: 'Edición limitada del catálogo' },
    { text: '1 reporte por mes' },
    { text: '15 créditos de IA por mes' },
    // Negatives stay grouped at the end so the cross icons render
    // together as a "what you don't get" block instead of being
    // sprinkled between checks.
    { text: 'Sin analíticas del catálogo', negative: true },
  ],
  basico: [
    { text: '1 catálogo' },
    { text: 'Todos los módulos disponibles' },
    { text: 'Analíticas del catálogo' },
    { text: 'Hasta 10 reportes por mes' },
    { text: '200 créditos de IA por mes' },
    { text: 'Diseño personalizable' },
    { text: 'Soporte prioritario' },
  ],
  avanzado: [
    { text: '2 catálogos' },
    { text: 'Todo del plan Básico' },
    { text: 'Analíticas del catálogo' },
    { text: 'Hasta 30 reportes por mes' },
    { text: '500 créditos de IA por mes' },
    { text: 'Vinculación de dominio personalizado (dominio aparte)' },
    { text: 'Soporte dedicado' },
  ],
  enterprise: [
    { text: 'Todo del plan Avanzado' },
    { text: 'Límites ampliados según acuerdo' },
    { text: 'Soporte dedicado' },
  ],
};

import { PlanFeature } from './plan.model';

/** Features que promete cada plan — única fuente de verdad, la consumen la
 *  página de planes (cards) y la sección "Tu plan incluye" de Mi Perfil.
 *  Los textos son keys de transloco (KEY-AS-TEXT). */
export const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  gratis: [
    { text: '1 catálogo' },
    { text: 'Hasta 25 órdenes por mes' },
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
    { text: 'Órdenes ilimitadas' },
    { text: 'Todos los módulos disponibles' },
    { text: 'Analíticas del catálogo' },
    { text: 'Hasta 10 reportes por mes' },
    { text: '200 créditos de IA por mes' },
    { text: 'Diseño personalizable' },
    { text: 'Soporte prioritario' },
  ],
  pro: [
    { text: '1 catálogo' },
    { text: 'Hasta 500 productos' },
    { text: 'Todo del plan Básico' },
    { text: 'Analíticas del catálogo' },
    { text: 'Hasta 20 reportes por mes' },
    { text: '350 créditos de IA por mes' },
    { text: 'Soporte prioritario' },
  ],
  avanzado: [
    { text: '2 catálogos' },
    { text: 'Productos ilimitados' },
    { text: 'Todo del plan Pro' },
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

/** Versión DETALLADA por plan — sin atajos tipo "Todo del plan Básico":
 *  enumera cada límite con su número real (fuente: tabla `plans` +
 *  asignaciones de créditos IA). La usa "Tu plan incluye" en Mi Perfil;
 *  las cards de la página de planes siguen usando la versión compacta. */
export const PLAN_FEATURES_DETAILED: Record<string, PlanFeature[]> = {
  gratis: [
    { text: '1 catálogo' },
    { text: 'Hasta 10 productos' },
    { text: 'Hasta 25 órdenes por mes' },
    { text: '1 variante por producto' },
    { text: 'Hasta 2 adicionales por producto' },
    { text: '1 reporte por mes' },
    { text: '15 créditos de IA por mes' },
    { text: 'Edición limitada del catálogo' },
    { text: 'Sin analíticas del catálogo', negative: true },
    { text: 'Sin equipo de trabajo', negative: true },
    { text: 'Sin notificaciones por WhatsApp', negative: true },
  ],
  basico: [
    { text: '1 catálogo' },
    { text: 'Hasta 100 productos' },
    { text: 'Órdenes ilimitadas' },
    { text: 'Hasta 3 variantes por producto' },
    { text: 'Hasta 5 adicionales por producto' },
    { text: '1 miembro de equipo' },
    { text: 'Hasta 10 reportes por mes' },
    { text: '200 créditos de IA por mes' },
    { text: 'Todos los módulos disponibles' },
    { text: 'Analíticas del catálogo' },
    { text: 'Notificaciones de órdenes por WhatsApp' },
    { text: 'Diseño personalizable' },
    { text: 'Soporte prioritario' },
  ],
  pro: [
    { text: '1 catálogo' },
    { text: 'Hasta 500 productos' },
    { text: 'Órdenes ilimitadas' },
    { text: 'Hasta 10 variantes por producto' },
    { text: 'Hasta 10 adicionales por producto' },
    { text: 'Hasta 2 miembros de equipo' },
    { text: 'Hasta 20 reportes por mes' },
    { text: '350 créditos de IA por mes' },
    { text: 'Todos los módulos disponibles' },
    { text: 'Analíticas del catálogo' },
    { text: 'Notificaciones de órdenes por WhatsApp' },
    { text: 'Diseño personalizable' },
    { text: 'Soporte prioritario' },
  ],
  avanzado: [
    { text: '2 catálogos (ampliable con catálogos extra)' },
    { text: 'Productos ilimitados' },
    { text: 'Órdenes ilimitadas' },
    { text: 'Hasta 15 variantes por producto' },
    { text: 'Hasta 15 adicionales por producto' },
    { text: 'Hasta 3 miembros de equipo' },
    { text: 'Hasta 30 reportes por mes' },
    { text: '500 créditos de IA por mes' },
    { text: 'Todos los módulos disponibles' },
    { text: 'Analíticas del catálogo' },
    { text: 'Notificaciones de órdenes por WhatsApp' },
    { text: 'Diseño personalizable' },
    { text: 'Vinculación de dominio personalizado (dominio aparte)' },
    { text: 'Soporte dedicado' },
  ],
  enterprise: [
    { text: 'Hasta 10 catálogos' },
    { text: 'Productos ilimitados' },
    { text: 'Hasta 100 variantes por producto' },
    { text: 'Hasta 50 miembros de equipo' },
    { text: '2000 créditos de IA por mes' },
    { text: 'Todos los módulos disponibles' },
    { text: 'Analíticas del catálogo' },
    { text: 'Notificaciones de órdenes por WhatsApp' },
    { text: 'Vinculación de dominio personalizado (dominio aparte)' },
    { text: 'Soporte dedicado' },
  ],
};

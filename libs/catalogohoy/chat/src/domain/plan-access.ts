/** Planes con acceso al CRM/conexión de canales (solo Avanzado; enterprise por
 *  estar por encima). Pro NO. Debe coincidir con CHAT_ENABLED_PLANS del guard
 *  (apps/catalogohoy: modules/admin/chat-enabled.guard.ts). */
export const CHAT_ENABLED_PLANS = ['avanzado', 'enterprise'];

/** Override interno por slug: acceso al CRM aunque el plan no lo incluya.
 *  andes-4x4 (2026-07-30): habilitado como gesto por info errada (modal decía
 *  Pro). Debe coincidir con CHAT_ENABLED_SLUGS del guard. */
export const CHAT_ENABLED_SLUGS: string[] = ['andes-4x4'];

/** Regla única de acceso a la conexión de canales del CRM. La usan la landing
 *  de Chat y el hub Conectar; el guard de la ruta mantiene su propia copia
 *  (no puede importar del lib sin arrastrarlo al bundle eager del admin). */
export function canConnectChannels(slug: string, planId: string): boolean {
  return (
    CHAT_ENABLED_SLUGS.includes(slug) || CHAT_ENABLED_PLANS.includes(planId)
  );
}

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';

/** Planes con acceso al Punto de Venta (decisión 2026-09-25: solo Avanzado;
 *  enterprise por estar por encima). Sin allowlist: abierto a TODOS los
 *  catálogos de esos planes. */
export const POS_ENABLED_PLANS = ['avanzado', 'enterprise'];

/** Permite entrar a `/pos/**` solo si el plan del catálogo lo incluye y no
 *  está vencido; si no, manda a Planes (upsell, no un 404 seco).
 *
 *  Igual que chatEnabledGuard: el tenant se resuelve por la SESIÓN
 *  (TenantStore → id) y se consulta la DB directo — el PlanStore puede no
 *  haber cargado aún cuando corre el guard. */
export const posEnabledGuard: CanActivateFn = async () => {
  // inject() debe llamarse sincrónicamente (antes de cualquier await).
  const tenantStore = inject(TenantStore);
  const router = inject(Router);

  const tenantId = await tenantStore.getTenantIdAsync();
  if (!tenantId) return router.createUrlTree(['/admin']);

  const { data } = await SupabaseClientProvider.getInstance()
    .from('tenants')
    .select('plan_id, plan_expired')
    .eq('id', tenantId)
    .maybeSingle();

  const planId = (data?.plan_id as string | null) ?? '';
  if (data && POS_ENABLED_PLANS.includes(planId) && !data.plan_expired) {
    return true;
  }
  return router.createUrlTree(['/admin/plans']);
};

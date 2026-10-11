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

  const { data, error } = await SupabaseClientProvider.getInstance()
    .from('tenants')
    .select('plan_id, plan_expired, plan_expires_at')
    .eq('id', tenantId)
    .maybeSingle();

  // Error transitorio (red/5xx): no lo trates como "no tenés plan" (mandaría a
  // un tenant Avanzado pago a la página de upsell). Fail-closed a /admin neutro,
  // igual que chatEnabledGuard.
  if (error) return router.createUrlTree(['/admin']);

  const planId = (data?.plan_id as string | null) ?? '';

  // Vencimiento igual que plan.service.getTenantExpiration: el webhook de Stripe
  // puede poner plan_expired=true al cancelar, pero el período pago sigue hasta
  // plan_expires_at. Solo vencido si el flag está Y la fecha ya pasó — no
  // bloquear a quien ya pagó su período.
  const expiresAt = data?.plan_expires_at
    ? new Date(data.plan_expires_at as string)
    : null;
  const reallyExpired =
    (data?.plan_expired ?? false) &&
    expiresAt !== null &&
    expiresAt.getTime() <= Date.now();

  if (data && POS_ENABLED_PLANS.includes(planId) && !reallyExpired) {
    return true;
  }
  return router.createUrlTree(['/admin/plans']);
};

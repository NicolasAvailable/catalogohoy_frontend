import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';

/** Override interno: catálogos con el módulo de Chats habilitado sin importar
 *  su plan (nuestro tenant demo + pilotos que se agreguen a mano). */
export const CHAT_ENABLED_SLUGS = ['catalogohoy'];

/** Planes con acceso al CRM de WhatsApp (decisión 2026-07-21: Pro y Avanzado;
 *  enterprise incluido por estar por encima). El sidebar usa la misma lista
 *  para mostrar/ocultar el menú. */
export const CHAT_ENABLED_PLANS = ['pro', 'avanzado', 'enterprise'];

/** 🚦 Switch de LANZAMIENTO del CRM (patrón ENTERPRISE_CARD_VISIBLE): en
 *  false solo la allowlist ve el módulo — permite mergear/deployar y hacer el
 *  E2E real en prod sin exponerlo a los clientes. Flip a true = lanzamiento
 *  a los planes de CHAT_ENABLED_PLANS. */
export const CHAT_PLAN_GATING_LIVE = true;

/** Permite entrar a `/admin/chat/**` si el catálogo está en la allowlist
 *  interna O su plan lo incluye (y no está vencido).
 *
 *  El tenant se resuelve por la SESIÓN (TenantStore → id) y se consulta la DB
 *  directo: el PlanStore puede no haber cargado aún cuando corre el guard, y
 *  parsear el slug de la URL no sirve en dev (en `/admin/...` el primer
 *  segmento del path es "admin", no un slug). */
export const chatEnabledGuard: CanActivateFn = async () => {
  // inject() debe llamarse sincrónicamente (antes de cualquier await).
  const tenantStore = inject(TenantStore);
  const router = inject(Router);

  const tenantId = await tenantStore.getTenantIdAsync();
  if (!tenantId) return router.createUrlTree(['/admin']);

  const { data } = await SupabaseClientProvider.getInstance()
    .from('tenants')
    .select('slug, plan_id, plan_expired')
    .eq('id', tenantId)
    .maybeSingle();
  if (!data) return router.createUrlTree(['/admin']);

  if (CHAT_ENABLED_SLUGS.includes(data.slug ?? '')) return true;

  const allowed =
    CHAT_PLAN_GATING_LIVE &&
    !data.plan_expired &&
    CHAT_ENABLED_PLANS.includes(data.plan_id ?? '');
  return allowed ? true : router.createUrlTree(['/admin']);
};

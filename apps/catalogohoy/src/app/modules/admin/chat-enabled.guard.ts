import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';

/** Override interno por slug: VACÍO desde 2026-07-24 (decisión de Nicolás: sin
 *  allowlist, el acceso al CRM se decide SOLO por plan). Se deja el array por si
 *  hiciera falta un piloto puntual en el futuro. */
export const CHAT_ENABLED_SLUGS: string[] = [];

/** Planes que pueden CONECTAR un canal (decisión 2026-07-24: solo Avanzado;
 *  enterprise por estar por encima; Pro NO). Ojo: la VISIBILIDAD del módulo ya
 *  NO depende de esto — todos los catálogos ven la sección cuando el CRM está
 *  lanzado. El gate por plan vive en connect-channels (copia local de esta
 *  lista) y se dispara al intentar conectar. */
export const CHAT_ENABLED_PLANS = ['avanzado', 'enterprise'];

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
    .select('slug')
    .eq('id', tenantId)
    .maybeSingle();
  if (!data) return router.createUrlTree(['/admin']);

  if (CHAT_ENABLED_SLUGS.includes(data.slug ?? '')) return true;

  // Todos los catálogos pueden VER/ENTRAR al módulo cuando el CRM está lanzado;
  // la validación por plan (Avanzado/Enterprise) se aplica al CONECTAR un canal
  // (canConnect en connect-channels), no al entrar a la sección.
  return CHAT_PLAN_GATING_LIVE ? true : router.createUrlTree(['/admin']);
};

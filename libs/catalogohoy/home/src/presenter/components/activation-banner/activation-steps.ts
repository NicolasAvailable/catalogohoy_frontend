/**
 * Lógica pura (sin Angular) de los hitos de activación que empuja el banner
 * in-app (CAT-73) y — el mismo criterio — el checklist del Inicio. Se extrae
 * para poder testearla sin arrastrar los barrels pesados de los stores.
 *
 * Hitos (derivados del estado real del catálogo, sin flags persistidos):
 *   1. product   → tiene al menos un producto
 *   2. customize → logo / banner / descripción
 *   3. sellers   → vendedores de WhatsApp del checkout
 *   4. notify    → avisos de órdenes por WhatsApp (plan pago; en gratis es
 *                  upsell → `locked`, no cuenta como meta de activación)
 */

export interface ActivationStep {
  id: 'product' | 'customize' | 'sellers' | 'notify';
  icon: string;
  title: string;
  hint: string;
  ctaLabel: string;
  link: string;
  queryParams: Record<string, string> | null;
  done: boolean;
  locked: boolean;
}

export interface ActivationState {
  /** Productos del plan usage (0 si aún no cargó). */
  productCount: number;
  /** logo || banner || descripción con contenido. */
  hasCustomize: boolean;
  /** Cantidad de vendedores de WhatsApp configurados. */
  sellerCount: number;
  /** Número de avisos WhatsApp configurado (null = sin configurar). */
  notifyNumber: string | null;
  /** Plan gratis → el hito de avisos es upsell (locked). */
  isFree: boolean;
}

/** Construye los 4 hitos con su estado `done`/`locked` a partir del estado. */
export function buildActivationSteps(s: ActivationState): ActivationStep[] {
  return [
    {
      id: 'product',
      icon: 'package',
      title: 'Crea tu primer producto',
      hint: 'Súbelo con foto y precio para estrenar tu catálogo.',
      ctaLabel: 'Crear producto',
      link: '/admin/products',
      queryParams: null,
      done: s.productCount > 0,
      locked: false,
    },
    {
      id: 'customize',
      icon: 'palette',
      title: 'Personaliza tu catálogo',
      hint: 'Sube tu logo, una descripción y tus colores.',
      ctaLabel: 'Personalizar',
      link: '/admin/catalog/edit',
      queryParams: { tab: 'general' },
      done: s.hasCustomize,
      locked: false,
    },
    {
      id: 'sellers',
      icon: 'message-circle',
      title: 'Agrega tus vendedores de WhatsApp',
      hint: 'Los números que recibirán los pedidos del checkout.',
      ctaLabel: 'Agregar vendedores',
      link: '/admin/catalog/edit',
      queryParams: { tab: 'payments', section: 'whatsapp-sellers' },
      done: s.sellerCount > 0,
      locked: false,
    },
    {
      id: 'notify',
      icon: 'smartphone',
      title: 'Activa los avisos de órdenes por WhatsApp',
      hint: 'Un WhatsApp cada vez que entra una orden nueva.',
      ctaLabel: s.isFree ? 'Ver planes' : 'Configurar avisos',
      link: s.isFree ? '/admin/plans' : '/admin/catalog/edit',
      queryParams: s.isFree ? null : { tab: 'notifications' },
      done: !!s.notifyNumber,
      locked: s.isFree,
    },
  ];
}

/** Primer hito no-hecho y no-locked (el próximo paso que empujamos). */
export function firstPendingStep(steps: ActivationStep[]): ActivationStep | null {
  return steps.find((x) => !x.done && !x.locked) ?? null;
}

/** El catálogo está activado cuando no queda ningún hito real (no-locked). */
export function activationDone(steps: ActivationStep[]): boolean {
  return !steps.some((x) => !x.locked && !x.done);
}

/** El banner se oculta en el Inicio (/admin), donde ya está el checklist. */
export function isHomeUrl(url: string): boolean {
  const path = url.split('?')[0].replace(/\/$/, '');
  return path === '/admin';
}

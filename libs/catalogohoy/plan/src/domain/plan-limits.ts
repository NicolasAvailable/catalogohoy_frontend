import { Plan } from './plan.model';

/** Fotos por producto de cada plan si `plans.max_photos` todavía no llegó
 *  (0 = ilimitado). La fuente de verdad es la base de datos. */
export const DEFAULT_PHOTOS_BY_PLAN: Readonly<Record<string, number>> = {
  gratis: 3,
  basico: 10,
  pro: 20,
  avanzado: 50,
  enterprise: 0,
};

/** Fila de `tenant_limits`: los límites efectivos de una tienda (los de su plan,
 *  o a medida si `is_custom`). */
export interface TenantLimitsRow {
  max_products: number;
  max_photos: number;
  max_variants: number;
  max_addons: number;
  is_custom: boolean;
}

/** Fotos por producto permitidas (0 = ilimitado). */
export function photoLimitOf(plan: Pick<Plan, 'id' | 'maxPhotos'> | null | undefined): number {
  if (plan?.maxPhotos != null) return plan.maxPhotos;
  return DEFAULT_PHOTOS_BY_PLAN[plan?.id ?? 'gratis'] ?? 3;
}

/** El plan con los límites propios de la tienda encima. Sin fila = los del plan. */
export function withTenantLimits(plan: Plan, row: TenantLimitsRow | null | undefined): Plan {
  if (!row) return plan;
  return {
    ...plan,
    maxProducts: row.max_products,
    maxPhotos: row.max_photos,
    maxVariants: row.max_variants,
    maxAddons: row.max_addons,
    hasCustomLimits: row.is_custom,
  };
}

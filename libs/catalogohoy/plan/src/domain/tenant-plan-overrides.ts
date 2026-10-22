/** Límites a medida para tiendas puntuales (excepciones comerciales acordadas
 *  con el cliente). Pisan los del plan solo para ese tenant; el resto de las
 *  tiendas del mismo plan no cambia. */
export interface TenantPlanOverride {
  /** Fotos por producto (0 = ilimitado). */
  maxPhotos?: number;
  /** Variantes por producto. */
  maxVariants?: number;
}

export const TENANT_PLAN_OVERRIDES: Readonly<Record<number, TenantPlanOverride>> = {
  // L-Gante Store (Básico anual, 2026-10-22): tienda de ropa, hasta ~15 colores
  // por modelo y hasta 50 fotos por producto.
  3797: { maxPhotos: 50, maxVariants: 20 },
};

export function tenantPlanOverride(tenantId: number | null | undefined): TenantPlanOverride {
  return tenantId != null ? TENANT_PLAN_OVERRIDES[Number(tenantId)] ?? {} : {};
}

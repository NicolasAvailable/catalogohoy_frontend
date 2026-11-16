/**
 * Gate por catálogo para la ETIQUETA de la opción base del selector de
 * variantes de la vitrina pública. Por defecto, cuando un producto tiene
 * variantes, el selector antepone la opción base rotulada "Producto original".
 *
 * Para los tenants de esta lista, esa opción base se muestra con el NOMBRE DEL
 * PRODUCTO (p. ej. "Set Rubí") en vez de "Producto original" — más claro para
 * negocios donde la base ES el producto principal y las variantes son
 * presentaciones/colores. La opción base SIGUE apareciendo (es el producto
 * principal); solo cambia su rótulo.
 *
 * Beta privada por pedido puntual. Para abrirlo a más catálogos, agregá su
 * `tenant_id`. Para todos (o para volverlo self-serve), reemplazá los
 * llamadores y borrá este archivo.
 */
export const BASE_VARIANT_PRODUCT_NAME_TENANT_IDS: readonly number[] = [
  3656, // Style Riss & Duranta SexShop (Risbeth)
];

/** True cuando la opción base del selector debe rotularse con el nombre del
 *  producto en vez de "Producto original". */
export function baseVariantUsesProductName(
  tenantId: number | null | undefined
): boolean {
  return (
    tenantId != null && BASE_VARIANT_PRODUCT_NAME_TENANT_IDS.includes(tenantId)
  );
}

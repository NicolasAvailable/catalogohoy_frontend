/**
 * Gate por catálogo para OCULTAR la opción sintética "Producto original" en el
 * selector de variantes de la vitrina pública. Por defecto, cuando un producto
 * tiene variantes, el selector antepone "Producto original" (el producto base)
 * y luego las variantes. Para negocios donde cada unidad ES una variante
 * (p. ej. lencería por color), esa opción base es ruido y confunde.
 *
 * Beta privada por pedido puntual: solo los tenants de esta lista ven su
 * selector SIN "Producto original" (abre con la primera variante seleccionada);
 * el resto conserva el comportamiento normal.
 *
 * Para abrirlo a más catálogos, agregá su `tenant_id`. Para todos (o para
 * volverlo self-serve con un toggle en la config), reemplazá los llamadores y
 * borrá este archivo.
 */
export const HIDE_BASE_VARIANT_TENANT_IDS: readonly number[] = [
  3656, // Style Riss & Duranta SexShop (Risbeth) — lencería, solo variantes de color
];

/** True cuando el selector público debe ocultar la opción "Producto original". */
export function isBaseVariantHidden(
  tenantId: number | null | undefined
): boolean {
  return tenantId != null && HIDE_BASE_VARIANT_TENANT_IDS.includes(tenantId);
}

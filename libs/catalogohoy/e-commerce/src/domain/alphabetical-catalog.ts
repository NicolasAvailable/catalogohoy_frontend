/**
 * Gate por catálogo para ordenar la vitrina PÚBLICA alfabéticamente (por nombre
 * de producto) en vez del orden manual (`position`). Beta privada: mientras lo
 * pide un solo cliente, solo los tenants de esta lista ven su catálogo ordenado
 * A→Z; el resto conserva el orden manual del admin.
 *
 * Solo afecta la vitrina pública (lo que ve el cliente final); el orden del
 * listado de productos en el admin es otro code path y no se toca.
 *
 * Para abrirlo a más catálogos, agregá su `tenant_id`. Para todos, reemplazá
 * los llamadores por `true` y borrá este archivo.
 */
export const ALPHABETICAL_CATALOG_TENANT_IDS: readonly number[] = [
  2421, // Distribuidora Moto Fox (slug `distribuidoramotofox`)
];

/** True cuando la vitrina pública del catálogo debe ordenarse alfabéticamente. */
export function isAlphabeticalCatalogEnabled(
  tenantId: number | null | undefined
): boolean {
  return tenantId != null && ALPHABETICAL_CATALOG_TENANT_IDS.includes(tenantId);
}

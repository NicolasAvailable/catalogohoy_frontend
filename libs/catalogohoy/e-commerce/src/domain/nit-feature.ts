/**
 * Gate por catálogo para el campo NIT (Número de Identificación Tributaria,
 * Guatemala) en el checkout público. Beta privada: mientras solo lo pide un
 * cliente, únicamente los tenants de esta lista ven el campo NIT (obligatorio)
 * en su checkout. El resto de los catálogos no lo ven.
 *
 * El VALOR del NIT se guarda en `orders.nit` y se muestra en el detalle /
 * PDF / factura de forma condicional a que exista — por eso el display no
 * necesita este gate, solo la captura en el checkout.
 *
 * Para abrirlo a más catálogos, agregá su `tenant_id`. Para todos, reemplazá
 * los llamadores por `true` y borrá este archivo.
 */
export const NIT_FEATURE_TENANT_IDS: readonly number[] = [
  1702, // Droguería El Paisano (slug `drogueria-el-paisano`, Guatemala)
];

/** True cuando el catálogo debe pedir el NIT (obligatorio) en su checkout. */
export function isNitFeatureEnabled(
  tenantId: number | null | undefined
): boolean {
  return tenantId != null && NIT_FEATURE_TENANT_IDS.includes(tenantId);
}

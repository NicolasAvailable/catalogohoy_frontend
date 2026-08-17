/**
 * Early-access gate for the in-store "Registrar venta" experience
 * (recibo / nota de entrega + evidencia de pago). Private beta: while we
 * validate it with the first client, only the tenants listed here see the
 * "Registrar venta" button, the payment-evidence card, and the "Recibo de
 * Venta" PDF wording. Everyone else keeps the plain order flow.
 *
 * To open it to more tenants, add their `tenant_id`. To ship it to everyone,
 * replace the callers with `true` and delete this file.
 */
export const VENTA_FEATURE_TENANT_IDS: readonly number[] = [
  614, // Stendencia (slug `stendencia`)
];

/** True when the given tenant has early access to the "Registrar venta" feature. */
export function isVentaFeatureEnabled(
  tenantId: number | null | undefined
): boolean {
  return tenantId != null && VENTA_FEATURE_TENANT_IDS.includes(tenantId);
}

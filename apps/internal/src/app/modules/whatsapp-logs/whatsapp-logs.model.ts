export type WhatsappLogStatus = 'sent' | 'failed' | 'skipped';

export type WhatsappTemplateType =
  | 'order_received'
  | 'order_completed'
  | 'plan_expiring'
  | 'payment_failed';

export interface WhatsappLog {
  id: number;
  tenantId: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
  templateType: string;
  recipient: string | null;
  status: WhatsappLogStatus;
  messageId: string | null;
  error: string | null;
  variables: string[] | null;
  urlButtonParam: string | null;
  createdAt: string;
}

/** Un dato enviado en la notificación: etiqueta legible + valor. */
export interface WhatsappLogField {
  label: string;
  value: string;
}

/** Costo/volumen de un mes según Meta (pricing_analytics de la WABA). */
export interface WhatsappMonthCost {
  month: string; // YYYY-MM
  categories: Record<string, { volume: number; cost: number }>;
  volume: number;
  cost: number;
}

/** Respuesta de la edge function `whatsapp-stats` (facturación real de Meta). */
export interface WhatsappStats {
  wabaId: string;
  source: 'pricing' | 'conversation' | null;
  months: WhatsappMonthCost[];
  metaError: string | null;
}

/** Una fila del agregado mensual (RPC whatsapp_notification_stats_admin). */
export interface WhatsappMonthlyRow {
  month: string; // YYYY-MM
  templateType: string;
  sent: number;
  failed: number;
  skipped: number;
}

// Categoría de facturación de cada plantilla en Meta. Debe seguir las
// recategorizaciones del WhatsApp Manager: plan_expiry_warning y
// order_pending_reminder quedaron MARKETING el 14-ago-2026.
export const TEMPLATE_CATEGORY: Record<string, 'MARKETING' | 'UTILITY'> = {
  order_received: 'UTILITY',
  order_completed: 'UTILITY',
  payment_failed: 'UTILITY',
  plan_expiring: 'MARKETING',
  order_pending_reminder: 'MARKETING',
};

/** Etiqueta legible para la categoría de facturación de Meta. */
export function categoryLabel(category: string): string {
  switch (category) {
    case 'MARKETING':
      return 'Marketing';
    case 'UTILITY':
      return 'Utilidad';
    case 'SERVICE':
      return 'Servicio';
    case 'AUTHENTICATION':
      return 'Autenticación';
    default:
      return category;
  }
}

// Las variables se mandan posicionalmente ({{1}}, {{2}}, ...). Estos son los
// significados de cada posición por tipo de template (según el trigger
// notify_order_whatsapp). Si el template cambia o no está mapeado, se cae a
// "Variable N" para no mentir sobre el contenido.
const TEMPLATE_VARIABLE_LABELS: Record<string, string[]> = {
  order_received: ['Catálogo', 'Cliente', 'Teléfono', 'Productos', 'Total'],
  order_completed: ['Cliente', 'Catálogo'],
};

/**
 * Desglosa las variables posicionales de una notificación en pares
 * etiqueta/valor legibles para mostrar en el panel.
 */
export function describeVariables(log: WhatsappLog): WhatsappLogField[] {
  const labels = TEMPLATE_VARIABLE_LABELS[log.templateType] ?? [];
  const values = log.variables ?? [];
  const fields = values.map((value, i) => ({
    label: labels[i] ?? `Variable ${i + 1}`,
    value,
  }));
  if (log.urlButtonParam) {
    fields.push({ label: 'Pedido (botón)', value: `#${log.urlButtonParam}` });
  }
  return fields;
}

/** Etiqueta legible para cada tipo de template de WhatsApp. */
export function templateLabel(type: string): string {
  switch (type) {
    case 'order_received':
      return 'Nuevo pedido';
    case 'order_completed':
      return 'Pedido completado';
    case 'plan_expiring':
      return 'Plan por vencer';
    case 'payment_failed':
      return 'Cobro fallido';
    case 'order_pending_reminder':
      return 'Pedido sin atender';
    case 'activation_no_product':
      return 'Activación sin productos';
    case 'setup_missing_whatsapp':
      return 'Falta configurar WhatsApp';
    default:
      return type;
  }
}

export function statusLabel(status: WhatsappLogStatus): string {
  switch (status) {
    case 'sent':
      return 'Enviada';
    case 'failed':
      return 'Fallida';
    case 'skipped':
      return 'Omitida';
  }
}

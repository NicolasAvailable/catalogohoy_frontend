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
  urlButtonParam: string | null;
  createdAt: string;
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

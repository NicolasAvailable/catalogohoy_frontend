/** Cuota diaria de envío que reporta Amazon SES. */
export interface SesQuota {
  /** Tope de envíos en 24h (0 = sin límite / sandbox). */
  Max24HourSend: number;
  /** Máximo de emails por segundo. */
  MaxSendRate: number;
  /** Enviados en las últimas 24h. */
  SentLast24Hours: number;
}

/** Un día agregado de la serie de envíos. */
export interface SesDaily {
  day: string; // YYYY-MM-DD
  attempts: number;
  bounces: number;
  complaints: number;
  rejects: number;
}

/** Métricas de correo que devuelve la edge function `ses-stats`. */
export interface SesStats {
  quota: SesQuota | null;
  prodAccess: boolean | null;
  sendingEnabled: boolean | null;
  /** Ventana de la serie (SES conserva ~14 días de estadísticas). */
  windowDays: number;
  totals: {
    attempts: number;
    bounces: number;
    complaints: number;
    rejects: number;
    delivered: number;
  };
  bounceRate: number;
  complaintRate: number;
  daily: SesDaily[];
  cost: {
    pricePerThousandUsd: number;
    windowUsd: number;
    monthAttempts: number;
    monthUsd: number;
  };
  /** Si el open/click tracking está activo (fase 2). */
  trackingEnabled: boolean;
}

/** Una fila del log por-correo (RPC list_ses_emails_admin). */
export interface SesEmailRow {
  message_id: string;
  recipient: string | null;
  subject: string | null;
  /** sent | delivered | bounced | complaint | rejected | opened | clicked */
  status: string;
  sent_at: string | null;
  last_event_at: string | null;
  bounce_type: string | null;
  diagnostic: string | null;
}

/** Filtros de estado disponibles para el log de correos. */
export const SES_STATUS_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'sent', label: 'Enviados' },
  { value: 'bounced', label: 'Rebotados' },
  { value: 'complaint', label: 'Quejas' },
  { value: 'rejected', label: 'Rechazados' },
];

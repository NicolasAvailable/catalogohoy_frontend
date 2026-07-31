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

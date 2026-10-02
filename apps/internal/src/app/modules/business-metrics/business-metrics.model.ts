export interface MonthPoint {
  month: string;
  count: number;
}

export interface MoMMetric {
  thisMonth: number;
  prevMonth: number;
  series: MonthPoint[];
}

export interface PlanMix {
  planId: string;
  count: number;
}

/** Lo que devuelve el RPC `business_metrics_admin` (agregados de la base). */
export interface CoreBusinessMetrics {
  monthStart: string;
  signups: MoMMetric;
  activeMerchants: MoMMetric;
  planMix: PlanMix[];
  payingCount: number;
}

/** Métricas consolidadas del negocio (ingresos + crecimiento + costos/margen).
 *  Ingresos salen de la edge fn `admin-revenue-metrics` (Stripe live + manual);
 *  el resto del RPC `business_metrics_admin` y de `business_expenses`. */
export interface BusinessMetrics {
  // Ingresos
  mrrUsd: number;
  arrUsd: number;
  collectedThisMonthUsd: number;
  payingCount: number;
  arpaUsd: number;
  // Crecimiento
  signups: MoMMetric;
  activeMerchants: MoMMetric;
  planMix: PlanMix[];
  // Volumen / plataforma
  gmvUsd: number;
  completedOrders: number;
  // Retención
  churnRatePct: number;
  // Costos (mensuales)
  opexMonthlyUsd: number;
  whatsappCostUsd: number;
  stripeFeesUsd: number;
  aiCredits: number;
  // Margen / EBITDA (run-rate mensual; IA aún no entra en USD)
  variableCostsUsd: number;
  contributionMarginUsd: number;
  contributionMarginPct: number;
  ebitdaUsd: number;
  ebitdaPct: number;
}

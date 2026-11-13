import { TopPayer } from '../dashboard/live-metrics.service';

export interface MonthPoint {
  month: string;
  count: number;
}

export interface MoMMetric {
  thisMonth: number;
  prevMonth: number;
  /** Mismo tramo del mes anterior (hasta el mismo día) → delta comparable. */
  prevMonthToDate: number;
  series: MonthPoint[];
}

/** Movimiento de MRR entre los dos snapshots más recientes (RPC `mrr_movement_admin`).
 *  `ready=false` mientras no haya 2 meses de snapshots. */
export interface MrrMovement {
  ready: boolean;
  snapshots?: number;
  curMonth?: string;
  prevMonth?: string;
  startMrr?: number;
  newMrr?: number;
  expansionMrr?: number;
  contractionMrr?: number;
  churnedMrr?: number;
  endMrr?: number;
  nrrPct?: number;
}

/** Embudo de prueba gratis (RPC `trial_funnel_admin`). */
export interface TrialFunnel {
  started: number;
  inTrial: number;
  converted: number;
  conversionPct: number;
}

/** Registros por día y cuántos de esos usuarios hoy pagan (RPC
 *  `signup_conversion_daily_admin`). */
export interface ConversionDay {
  day: string;
  signups: number;
  converted: number;
}

export interface SignupConversion {
  days: number;
  signups: number;
  converted: number;
  series: ConversionDay[];
}

/** Churn por catálogo desde las fotos mensuales de MRR (RPC `churn_summary_admin`). */
export interface ChurnedTenant {
  tenantId: number;
  name: string | null;
  slug: string | null;
  planId: string;
  mrrUsd: number;
}

export interface ChurnPeriod {
  month: string;
  startCount: number;
  startMrr?: number;
  churnedCount: number;
  lostMrr: number;
  churnRatePct: number;
  churned?: ChurnedTenant[];
}

export interface ChurnSummary {
  thisMonth: ChurnPeriod | null;
  lastMonth: ChurnPeriod | null;
}

export interface DemoTenant {
  id: number;
  name: string | null;
  slug: string | null;
  planId: string | null;
  ownerEmail: string | null;
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
  /** Catálogos marcados demo (excluidos de todo). */
  demoCount: number;
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
  /** Gastos fijos recurrentes (anuales /12). */
  opexMonthlyUsd: number;
  /** Pagos únicos cargados para el mes en curso. */
  opexOneTimeUsd: number;
  whatsappCostUsd: number;
  stripeFeesUsd: number;
  aiCredits: number;
  /** Costo real de IA del mes en USD (fal.ai + LLM + Whisper, aprox por feature). */
  aiCostUsd: number;
  // Margen / EBITDA (run-rate mensual; IA aún no entra en USD)
  variableCostsUsd: number;
  contributionMarginUsd: number;
  contributionMarginPct: number;
  /** Ganancia neta del mes (profit): MRR − costos variables − gastos fijos − pagos únicos del mes. */
  ebitdaUsd: number;
  ebitdaPct: number;
  /** Ganancia por catálogo pago (profit / pagos). Distinto del ARPA (que es ingreso). */
  profitPerAccountUsd: number;
  // Movimiento de MRR + retención por dólar + embudo de prueba
  movement: MrrMovement;
  trialFunnel: TrialFunnel;
  // Nuevos (2026-11-10)
  topPayers: TopPayer[];
  conversion: SignupConversion | null;
  churn: ChurnSummary | null;
  demoTenants: DemoTenant[];
  /** Pagos por Stripe / manual (incluye App Store y Play) para el detalle. */
  stripeMrrUsd: number;
  manualMrrUsd: number;
}

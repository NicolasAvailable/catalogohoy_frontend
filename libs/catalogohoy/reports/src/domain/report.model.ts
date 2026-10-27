// A metrics configuration is just a set of boolean toggles. Keeping it in a
// central interface lets us add new metrics (refunds, aov, etc.) without
// touching every consumer.
export interface MetricsConfig {
  orders: boolean;
  sales: boolean;
  topProducts: boolean;
  topCustomers: boolean;
  paymentMethods: boolean;
  comparison: boolean;
  profit: boolean;
  customers: boolean;
  channels: boolean;
  shipping: boolean;
  discounts: boolean;
  weekdays: boolean;
}

export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  orders: true,
  sales: true,
  topProducts: true,
  topCustomers: true,
  paymentMethods: true,
  comparison: true,
  profit: false,
  customers: false,
  channels: false,
  shipping: false,
  discounts: false,
  weekdays: false,
};

/**
 * Reports saved before the new metrics existed have no key for them. They
 * must not suddenly show sections (whose snapshot data they don't have), so
 * missing keys fall back to false — except paymentMethods, which those
 * reports always showed.
 */
export function normalizeMetricsConfig(
  raw: Partial<MetricsConfig> | null | undefined
): MetricsConfig {
  const base = Object.fromEntries(
    Object.keys(DEFAULT_METRICS_CONFIG).map((k) => [k, false])
  ) as unknown as MetricsConfig;
  return { ...base, paymentMethods: true, ...(raw ?? {}) };
}

/** Toggle list shown in the create form, in display order. */
export const METRIC_OPTIONS: { key: keyof MetricsConfig; label: string; hint: string }[] = [
  { key: 'orders',         label: 'Órdenes',                 hint: 'Total de órdenes y distribución por estado' },
  { key: 'sales',          label: 'Ventas',                  hint: 'Total del periodo y evolución día a día' },
  { key: 'comparison',     label: 'Comparación con el periodo anterior', hint: 'Cuánto subieron o bajaron ventas, órdenes y ticket promedio' },
  { key: 'profit',         label: 'Ganancia estimada',       hint: 'Ventas menos costo de los productos y comisiones (sin canceladas)' },
  { key: 'topProducts',    label: 'Productos más vendidos',  hint: 'Top 10 por unidades e ingresos generados' },
  { key: 'topCustomers',   label: 'Mejores clientes',        hint: 'Top 10 por gasto total' },
  { key: 'customers',      label: 'Clientes nuevos vs. recurrentes', hint: 'Quién compró por primera vez y quién volvió' },
  { key: 'paymentMethods', label: 'Métodos de pago',         hint: 'Órdenes y monto por cada método' },
  { key: 'channels',       label: 'Canales de venta',        hint: 'Catálogo online, punto de venta y órdenes manuales' },
  { key: 'shipping',       label: 'Entregas',                hint: 'Envíos vs. retiro en tienda y total cobrado por envío' },
  { key: 'discounts',      label: 'Descuentos',              hint: 'Total descontado y cupones más usados' },
  { key: 'weekdays',       label: 'Mejores días de la semana', hint: 'Ventas según el día de la semana' },
];

export interface ReportOrdersMetric {
  total: number;
  byStatus: Record<string, number>;
}

export interface ReportSalesByDay {
  date: string; // ISO date (YYYY-MM-DD)
  total: number;
}

export interface ReportSalesMetric {
  /** Total in USD (the universal currency across all orders). */
  total: number;
  /** Total in bolívares — relevant only for VE tenants. 0 otherwise. */
  totalBs: number;
  /** sales_total / orders_total — 0 when no orders in the period. */
  avgTicket: number;
  byDay: ReportSalesByDay[];
}

export interface ReportTopProduct {
  productId: string;
  name: string;
  photo: string | null;
  quantity: number;
  revenue: number;
}

export interface ReportPaymentMethod {
  method: string;
  ordersCount: number;
  totalRevenue: number;
}

export interface ReportTopCustomer {
  name: string | null;
  phone: string | null;
  ordersCount: number;
  /** Total spent in USD — the universal source of truth. */
  totalSpent: number;
  /** Total spent in bolívares — populated for VE tenants, 0 otherwise. */
  totalSpentBs: number;
}

export interface ReportSnapshot {
  period: { start: string; end: string };
  orders: ReportOrdersMetric;
  sales: ReportSalesMetric;
  topProducts: ReportTopProduct[];
  topCustomers: ReportTopCustomer[];
  paymentMethods: ReportPaymentMethod[];
  // Added 2026-10 — absent in older snapshots.
  comparison?: ReportComparison;
  profit?: ReportProfit;
  channels?: ReportChannel[];
  shipping?: ReportShipping;
  discounts?: ReportDiscounts;
  customers?: ReportCustomers;
  weekdays?: ReportWeekday[];
}

export interface ReportComparison {
  previousStart: string;
  previousEnd: string;
  orders: number;
  sales: number;
  avgTicket: number;
}

export interface ReportProfit {
  hasCosts: boolean;
  revenue: number;
  cost: number;
  commission: number;
  profit: number;
}

export interface ReportChannel {
  channel: string;
  ordersCount: number;
  total: number;
}

export interface ReportShipping {
  totalFees: number;
  methods: { name: string; type: string | null; ordersCount: number }[];
}

export interface ReportDiscounts {
  total: number;
  ordersCount: number;
  codes: { code: string; uses: number; total: number }[];
}

export interface ReportCustomers {
  total: number;
  new: number;
  returning: number;
}

export interface ReportWeekday {
  weekday: number; // 0 = domingo … 6 = sábado
  ordersCount: number;
  total: number;
}

export interface Report {
  id: number;
  tenantId: number;
  publicToken: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  metricsConfig: MetricsConfig;
  snapshot: ReportSnapshot;
  templateId: number | null;
  createdAt: string;
}

/** A saved report setup that can be generated again with fresh data. */
export interface ReportTemplate {
  id: number;
  tenantId: number;
  title: string;
  periodPreset: TemplatePeriodPreset;
  metricsConfig: MetricsConfig;
  createdAt: string;
}

/** Public-facing report: same shape plus the tenant branding for the HTML URL. */
export interface PublicReport {
  id: number;
  title: string;
  periodStart: string;
  periodEnd: string;
  metricsConfig: MetricsConfig;
  snapshot: ReportSnapshot;
  createdAt: string;
  tenant: {
    name: string;
    slug: string;
    logo: string | null;
    countryCode: string | null;
    currencyCode: string;
    currencySymbol: string;
  };
}

/** Preset date ranges shown in the create dialog. */
export type DateRangePreset =
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'previous_week'
  | 'previous_month'
  | 'current_month'
  | 'custom';

/** Templates store a relative period, never a fixed custom range. */
export type TemplatePeriodPreset = Exclude<DateRangePreset, 'custom'>;

export const DATE_RANGE_PRESETS: { key: DateRangePreset; label: string; days?: number }[] = [
  { key: 'last_7_days',    label: 'Últimos 7 días',  days: 7 },
  { key: 'last_30_days',   label: 'Últimos 30 días', days: 30 },
  { key: 'last_90_days',   label: 'Últimos 90 días', days: 90 },
  { key: 'previous_week',  label: 'Semana pasada' },
  { key: 'previous_month', label: 'Mes pasado' },
  { key: 'current_month',  label: 'Este mes' },
  { key: 'custom',         label: 'Personalizado' },
];

export function presetLabel(key: DateRangePreset): string {
  return DATE_RANGE_PRESETS.find((p) => p.key === key)?.label ?? key;
}

/**
 * Resolves a relative preset to concrete dates, as of `now`.
 * Weeks start on Monday. "Mes pasado" is the full previous calendar month,
 * so a monthly template generated any day of November covers all of October.
 */
export function resolvePresetRange(
  preset: TemplatePeriodPreset,
  now: Date = new Date()
): { start: Date; end: Date } {
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  switch (preset) {
    case 'previous_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case 'current_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case 'previous_week': {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - daysSinceMonday);
      const start = new Date(thisMonday);
      start.setDate(thisMonday.getDate() - 7);
      const end = new Date(thisMonday);
      end.setDate(thisMonday.getDate() - 1);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    default: {
      const days = DATE_RANGE_PRESETS.find((p) => p.key === preset)?.days ?? 30;
      const end = endOfDay(now);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));
      return { start: startOfDay(start), end };
    }
  }
}

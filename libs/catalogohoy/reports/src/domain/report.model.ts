// A metrics configuration is just a set of boolean toggles. Keeping it in a
// central interface lets us add new metrics (refunds, aov, etc.) without
// touching every consumer.
export interface MetricsConfig {
  orders: boolean;
  sales: boolean;
  topProducts: boolean;
  topCustomers: boolean;
}

export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  orders: true,
  sales: true,
  topProducts: true,
  topCustomers: true,
};

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
export type DateRangePreset = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom';

export const DATE_RANGE_PRESETS: { key: DateRangePreset; label: string; days?: number }[] = [
  { key: 'last_7_days',  label: 'Últimos 7 días',  days: 7 },
  { key: 'last_30_days', label: 'Últimos 30 días', days: 30 },
  { key: 'last_90_days', label: 'Últimos 90 días', days: 90 },
  { key: 'custom',       label: 'Personalizado' },
];

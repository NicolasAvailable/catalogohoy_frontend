import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconComponent } from '@ui';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { MetricsConfig, ReportSnapshot } from '../../domain';

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pendiente',
  approved:  'Aprobado',
  preparing: 'Preparando',
  shipped:   'Enviado',
  delivered: 'Entregado',
  completed: 'Completada',
  cancelled: 'Cancelada',
  rejected:  'Rechazado',
};

/**
 * Same palette as the status pills in the orders list so the report colors
 * match what the tenant already sees across the app.
 */
const STATUS_COLORS_MAP: Record<string, string> = {
  pending:   '#f59e0b', // amber
  approved:  '#6366f1', // indigo
  preparing: '#06b6d4', // cyan
  shipped:   '#8b5cf6', // violet
  delivered: '#10b981', // emerald
  completed: '#10b981', // emerald
  cancelled: '#ef4444', // red
  rejected:  '#ef4444', // red
};

const STATUS_FALLBACK = '#64748b'; // slate, for unknown/custom statuses

/**
 * Colors for the payment-method progress bars. Order matches ranking
 * so the #1 method always uses the primary indigo, #2 emerald, etc.
 */
const PAYMENT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#06b6d4',
  '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6',
];

interface ReportBranding {
  name: string;
  logo: string | null;
  countryCode: string | null;
  currencyCode: string;
  currencySymbol: string;
}

@Component({
  selector: 'lib-report-content',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    DecimalPipe,
    IconComponent,
    NgApexchartsModule,
  ],
  templateUrl: './report-content.html',
  styleUrl: './report-content.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportContent {
  public readonly title        = input<string>('Reporte');
  public readonly periodStart  = input<string>('');
  public readonly periodEnd    = input<string>('');
  public readonly createdAt    = input<string>('');
  public readonly metrics      = input.required<MetricsConfig>();
  public readonly snapshot     = input.required<ReportSnapshot>();
  public readonly branding     = input.required<ReportBranding>();

  /** True when the tenant is Venezuelan — shows both USD and Bs totals. */
  public readonly isVenezuela = computed(
    () => this.branding().countryCode === 'VE'
  );

  /**
   * Area chart (ng-apexcharts). Sparkline-style look achieved via explicit
   * grid/axes disabling — sparkline.enabled sometimes collapses the chart
   * height inside a flex parent, so we avoid it.
   */
  public readonly salesAreaOptions = computed<ApexOptions>(() => {
    // The RPC aggregates only days with orders. For the chart we want the
    // full requested period so the curve starts where the user picked it
    // (e.g. "últimos 30 días" should start 30 days back, even if the first
    // order happened later). Fill in missing days with 0.
    const series = this.buildSalesSeries();
    return {
      chart: {
        type: 'area',
        height: 224,
        fontFamily: 'inherit',
        foreColor: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: {
          speed: 400,
          animateGradually: { enabled: false },
        },
      },
      colors: ['#6366f1'],
      dataLabels: { enabled: false },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.2,
          opacityFrom: 0.55,
          opacityTo: 0.05,
          stops: [0, 100],
        },
      },
      grid: {
        borderColor: '#eef2ff',
        strokeDashArray: 4,
        padding: { left: 8, right: 8, top: 0, bottom: 0 },
      },
      series: [
        {
          name: 'Ventas',
          data: series.map((d) => ({
            x: new Date(d.date).getTime(),
            y: Number(d.total),
          })),
        },
      ],
      stroke: { curve: 'smooth', width: 3 },
      tooltip: {
        followCursor: true,
        theme: 'dark',
        x: { format: 'dd MMM yyyy' },
        // Chart data comes from orders.total_usd so we always display `$`
        // regardless of the tenant's local currency (the local-currency
        // equivalent is shown as a secondary KPI on the report header).
        y: { formatter: (value: number) => `$${value.toFixed(2)}` },
      },
      xaxis: {
        type: 'datetime',
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: '#94a3b8', fontSize: '11px' },
          datetimeFormatter: { day: 'dd MMM' },
        },
      },
      yaxis: {
        labels: {
          style: { colors: '#94a3b8', fontSize: '11px' },
          formatter: (v: number) => `$${v}`,
        },
      },
      markers: { size: 0, hover: { size: 5 } },
    };
  });

  /**
   * Pre-shaped data for the "Órdenes por estado" bar chart: one entry per
   * status with the label, count, color, and a normalized height (0-100%)
   * so the template can render plain CSS bars (no chart library needed).
   */
  public readonly statusBars = computed(() => {
    const by = this.snapshot().orders.byStatus ?? {};
    const entries = Object.entries(by).filter(([, count]) => count > 0);
    const max = entries.reduce((m, [, count]) => Math.max(m, count), 0);
    return entries.map(([key, count]) => ({
      key,
      label: STATUS_LABELS[key] ?? key,
      value: count,
      color: STATUS_COLORS_MAP[key] ?? STATUS_FALLBACK,
      // Keep the shortest bar at least 6% tall so single orders stay visible.
      height: max > 0 ? Math.max((count / max) * 100, 6) : 0,
    }));
  });

  /** Payment-method entries decorated with share % and their ranking color. */
  public readonly paymentMethods = computed(() => {
    const items = this.snapshot().paymentMethods ?? [];
    const maxCount = items.reduce(
      (max, m) => Math.max(max, m.ordersCount),
      0
    );
    return items.map((m, i) => ({
      ...m,
      color: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
      // Share of the top method — used to size the progress bar so the #1
      // method always fills it fully (looks cleaner than share-of-total when
      // there's one dominant method).
      share: maxCount > 0 ? (m.ordersCount / maxCount) * 100 : 0,
    }));
  });

  public statusLabel(key: string): string {
    return STATUS_LABELS[key] ?? key;
  }

  /**
   * Expands the RPC's byDay list (which only contains days with orders)
   * into one entry per day between periodStart and periodEnd (inclusive),
   * using 0 for days that had no orders. Keeps the chart's x-axis faithful
   * to the preset the user picked.
   */
  private buildSalesSeries(): { date: string; total: number }[] {
    const raw = this.snapshot().sales.byDay ?? [];
    if (!this.periodStart() || !this.periodEnd()) return raw;

    const byDate = new Map<string, number>();
    for (const d of raw) {
      byDate.set(d.date.slice(0, 10), Number(d.total));
    }

    const start = new Date(this.periodStart());
    start.setHours(0, 0, 0, 0);
    const end = new Date(this.periodEnd());
    end.setHours(0, 0, 0, 0);

    // Cap to 120 days so edge cases don't explode the array.
    const maxDays = 120;
    const daySpan =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const totalDays = Math.min(Math.max(daySpan, 1), maxDays);

    const result: { date: string; total: number }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < totalDays; i++) {
      const key = cursor.toISOString().slice(0, 10);
      result.push({ date: key, total: byDate.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }
}

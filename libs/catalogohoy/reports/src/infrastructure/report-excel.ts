import { E } from '@shared/domain';
import { Report } from '../domain';

/** One worksheet of the exported workbook: a name and its rows (first row = headers). */
export interface ReportSheet {
  name: string;
  rows: (string | number)[][];
}

export interface ReportExcelOptions {
  tenantName: string;
  /** VE tenants also get the bolívares columns, same as the on-screen report. */
  isVenezuela: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  completed: 'Completada',
  cancelled: 'Cancelada',
  rejected: 'Rechazado',
};

const CHANNEL_LABELS: Record<string, string> = {
  public: 'Catálogo online',
  pos: 'Punto de venta',
  manual: 'Órdenes manuales',
};

const WEEKDAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const day = (iso: string): string => (iso ? iso.slice(0, 10) : '');

/** % change vs the previous period, rounded to 1 decimal. Empty when nothing to compare. */
const pct = (current: number, previous: number): number | string =>
  previous ? Math.round(((current - previous) / previous) * 1000) / 10 : '';

/**
 * Turns a saved report into worksheets, one per section, following the same
 * metrics toggles as the on-screen report. Amounts are numbers in the same
 * unit the report shows, so the tenant can sum and filter them in Excel.
 */
export function buildReportSheets(
  report: Report,
  opts: ReportExcelOptions
): ReportSheet[] {
  const m = report.metricsConfig;
  const s = report.snapshot;
  const ve = opts.isVenezuela;
  // Same unit the on-screen report shows: amounts come from orders.total_usd
  // and the report prints them with "$" ("USD" next to Bs for VE).
  const cur = ve ? 'USD' : '$';
  const sheets: ReportSheet[] = [];

  // ── Resumen ────────────────────────────────────────────────────────────
  const summary: (string | number)[][] = [
    ['Reporte', report.title],
    ['Catálogo', opts.tenantName],
    ['Desde', day(report.periodStart)],
    ['Hasta', day(report.periodEnd)],
    ['Generado', day(report.createdAt)],
    [],
    ['Indicador', 'Valor'],
  ];
  if (m.orders) summary.push(['Órdenes', num(s.orders?.total)]);
  if (m.sales) {
    summary.push([`Ventas (${cur})`, num(s.sales?.total)]);
    if (ve) summary.push(['Ventas (Bs)', num(s.sales?.totalBs)]);
    summary.push([`Ticket promedio (${cur})`, num(s.sales?.avgTicket)]);
  }
  if (m.profit && s.profit?.hasCosts) {
    summary.push([`Ventas de productos (${cur})`, num(s.profit.revenue)]);
    summary.push([`Costo de productos (${cur})`, num(s.profit.cost)]);
    summary.push([`Comisiones (${cur})`, num(s.profit.commission)]);
    summary.push([`Ganancia estimada (${cur})`, num(s.profit.profit)]);
  }
  if (m.customers && s.customers) {
    summary.push(['Clientes', num(s.customers.total)]);
    summary.push(['Clientes nuevos', num(s.customers.new)]);
    summary.push(['Volvieron a comprar', num(s.customers.returning)]);
  }
  if (m.shipping && s.shipping) {
    summary.push([`Cobrado por envío (${cur})`, num(s.shipping.totalFees)]);
  }
  if (m.discounts && s.discounts) {
    summary.push([`Total descontado (${cur})`, num(s.discounts.total)]);
    summary.push(['Órdenes con descuento', num(s.discounts.ordersCount)]);
  }
  sheets.push({ name: 'Resumen', rows: summary });

  // ── Comparación ────────────────────────────────────────────────────────
  if (m.comparison && s.comparison) {
    const c = s.comparison;
    const rows: [string, number, number][] = [
      [`Ventas (${cur})`, num(s.sales?.total), num(c.sales)],
      ['Órdenes', num(s.orders?.total), num(c.orders)],
      [`Ticket promedio (${cur})`, num(s.sales?.avgTicket), num(c.avgTicket)],
    ];
    sheets.push({
      name: 'Comparación',
      rows: [
        ['Periodo anterior', `${day(c.previousStart)} a ${day(c.previousEnd)}`],
        [],
        ['Indicador', 'Este periodo', 'Periodo anterior', 'Cambio %'],
        ...rows.map(([label, now, prev]) => [label, now, prev, pct(now, prev)]),
      ],
    });
  }

  // ── Ventas por día ─────────────────────────────────────────────────────
  if (m.sales && (s.sales?.byDay?.length ?? 0) > 0) {
    sheets.push({
      name: 'Ventas por día',
      rows: [
        ['Fecha', `Ventas (${cur})`],
        ...s.sales.byDay.map((d) => [day(d.date), num(d.total)]),
      ],
    });
  }

  // ── Órdenes por estado ─────────────────────────────────────────────────
  if (m.orders) {
    const entries = Object.entries(s.orders?.byStatus ?? {}).filter(
      ([, n]) => Number(n) > 0
    );
    if (entries.length > 0) {
      sheets.push({
        name: 'Órdenes por estado',
        rows: [
          ['Estado', 'Órdenes'],
          ...entries.map(([k, n]) => [STATUS_LABELS[k] ?? k, num(n)]),
        ],
      });
    }
  }

  // ── Productos más vendidos ─────────────────────────────────────────────
  if (m.topProducts && (s.topProducts?.length ?? 0) > 0) {
    sheets.push({
      name: 'Productos',
      rows: [
        ['Producto', 'Unidades', `Ingresos (${cur})`],
        ...s.topProducts.map((p) => [p.name, num(p.quantity), num(p.revenue)]),
      ],
    });
  }

  // ── Mejores clientes ───────────────────────────────────────────────────
  if (m.topCustomers && (s.topCustomers?.length ?? 0) > 0) {
    const head = ['Cliente', 'Teléfono', 'Órdenes', `Total (${cur})`];
    if (ve) head.push('Total (Bs)');
    sheets.push({
      name: 'Clientes',
      rows: [
        head,
        ...s.topCustomers.map((c) => {
          const row: (string | number)[] = [
            c.name ?? '',
            c.phone ?? '',
            num(c.ordersCount),
            num(c.totalSpent),
          ];
          if (ve) row.push(num(c.totalSpentBs));
          return row;
        }),
      ],
    });
  }

  // ── Métodos de pago ────────────────────────────────────────────────────
  if (m.paymentMethods && (s.paymentMethods?.length ?? 0) > 0) {
    sheets.push({
      name: 'Métodos de pago',
      rows: [
        ['Método', 'Órdenes', `Monto (${cur})`],
        ...s.paymentMethods.map((p) => [
          p.method,
          num(p.ordersCount),
          num(p.totalRevenue),
        ]),
      ],
    });
  }

  // ── Canales ────────────────────────────────────────────────────────────
  if (m.channels && (s.channels?.length ?? 0) > 0) {
    sheets.push({
      name: 'Canales',
      rows: [
        ['Canal', 'Órdenes', `Total (${cur})`],
        ...(s.channels ?? []).map((c) => [
          CHANNEL_LABELS[c.channel] ?? c.channel,
          num(c.ordersCount),
          num(c.total),
        ]),
      ],
    });
  }

  // ── Entregas ───────────────────────────────────────────────────────────
  if (m.shipping && (s.shipping?.methods?.length ?? 0) > 0) {
    sheets.push({
      name: 'Entregas',
      rows: [
        ['Método de entrega', 'Órdenes'],
        ...(s.shipping?.methods ?? []).map((x) => [x.name, num(x.ordersCount)]),
      ],
    });
  }

  // ── Cupones ────────────────────────────────────────────────────────────
  if (m.discounts && (s.discounts?.codes?.length ?? 0) > 0) {
    sheets.push({
      name: 'Cupones',
      rows: [
        ['Cupón', 'Usos', `Descontado (${cur})`],
        ...(s.discounts?.codes ?? []).map((c) => [
          c.code,
          num(c.uses),
          num(c.total),
        ]),
      ],
    });
  }

  // ── Días de la semana ──────────────────────────────────────────────────
  if (m.weekdays && (s.weekdays?.length ?? 0) > 0) {
    const byDay = new Map((s.weekdays ?? []).map((w) => [w.weekday, w]));
    sheets.push({
      name: 'Días de la semana',
      rows: [
        ['Día', 'Órdenes', `Ventas (${cur})`],
        ...[1, 2, 3, 4, 5, 6, 0].map((d) => [
          WEEKDAY_LABELS[d],
          num(byDay.get(d)?.ordersCount),
          num(byDay.get(d)?.total),
        ]),
      ],
    });
  }

  return sheets;
}

/** Safe file name from the report title (keeps accents, drops symbols). */
export function reportExcelFileName(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || 'reporte'}.xlsx`;
}

/**
 * Downloads the report as `.xlsx`. xlsx is loaded lazily so it stays out of
 * the reports bundle until someone actually exports.
 */
export async function downloadReportExcel(
  report: Report,
  opts: ReportExcelOptions
): Promise<E.Either<Error, void>> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    for (const sheet of buildReportSheets(report, opts)) {
      const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
      const colCount = Math.max(...sheet.rows.map((r) => r.length), 0);
      ws['!cols'] = Array.from({ length: colCount }, (_, i) => ({
        wch: Math.min(
          45,
          Math.max(10, ...sheet.rows.map((r) => String(r[i] ?? '').length)) + 2
        ),
      }));
      // Excel limits sheet names to 31 chars.
      XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0, 31));
    }
    XLSX.writeFile(workbook, reportExcelFileName(report.title));
    return E.right(undefined);
  } catch {
    return E.left(new Error('No se pudo generar el Excel'));
  }
}

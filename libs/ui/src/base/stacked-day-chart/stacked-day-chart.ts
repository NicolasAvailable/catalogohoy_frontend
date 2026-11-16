import { Component, computed, input } from '@angular/core';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';

/** Una serie apilada: un color y un valor por día (mismo orden que `days`). */
export interface StackedDaySeries {
  name: string;
  color: string;
  data: number[];
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Barras por día apiladas por serie (estilo consola de uso de Claude): cada
 * barra es un día y cada color una serie; el tooltip lista el valor de cada
 * serie ese día y el total.
 */
@Component({
  selector: 'ui-stacked-day-chart',
  standalone: true,
  imports: [NgApexchartsModule],
  template: `
    <apx-chart
      [chart]="options().chart!"
      [colors]="options().colors!"
      [dataLabels]="options().dataLabels!"
      [grid]="options().grid!"
      [legend]="options().legend!"
      [plotOptions]="options().plotOptions!"
      [series]="options().series!"
      [states]="options().states!"
      [tooltip]="options().tooltip!"
      [xaxis]="options().xaxis!"
      [yaxis]="options().yaxis!"
    ></apx-chart>
  `,
})
export class StackedDayChartComponent {
  /** Días en 'YYYY-MM-DD'. */
  public readonly days = input.required<string[]>();
  public readonly series = input.required<StackedDaySeries[]>();
  /** Formato de los valores (monto con símbolo, cantidad de órdenes…). */
  public readonly format = input<(value: number) => string>((v) => String(v));
  public readonly height = input<number>(260);

  public readonly options = computed<ApexOptions>(() => {
    const days = this.days();
    const series = this.series();
    const format = this.format();
    const labels = days.map((d) => {
      const [, m, day] = d.split('-').map(Number);
      return new Date(2000, m - 1, day).toLocaleDateString('es', { day: 'numeric', month: 'short' });
    });
    return {
      chart: {
        type: 'bar',
        stacked: true,
        height: this.height(),
        fontFamily: 'inherit',
        foreColor: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      colors: series.map((s) => s.color),
      dataLabels: { enabled: false },
      grid: {
        borderColor: '#eef2ff',
        strokeDashArray: 4,
        padding: { left: 8, right: 8, top: 0, bottom: 0 },
      },
      legend: {
        show: true,
        position: 'bottom',
        horizontalAlign: 'left',
        fontSize: '12px',
        markers: { size: 5, shape: 'square' } as never,
        itemMargin: { horizontal: 8, vertical: 4 },
        labels: { colors: '#64748b' },
      },
      plotOptions: { bar: { columnWidth: '70%', borderRadius: 2, borderRadiusApplication: 'end', borderRadiusWhenStacked: 'last' } },
      series: series.map((s) => ({ name: s.name, data: s.data })),
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } },
      },
      tooltip: {
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const rows = series
            .map((s) => ({ s, v: s.data[dataPointIndex] ?? 0 }))
            .filter((r) => r.v > 0)
            .sort((a, b) => b.v - a.v);
          const total = rows.reduce((acc, r) => acc + r.v, 0);
          const lines = rows
            .map(
              (r) => `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
                <span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:2px;background:${r.s.color}"></span>${escapeHtml(r.s.name)}</span>
                <span style="font-weight:600">${escapeHtml(format(r.v))}</span></div>`
            )
            .join('');
          return `<div style="background:#fff;padding:10px 12px;min-width:180px;font-size:12px;color:#334155;display:flex;flex-direction:column;gap:6px">
            <div style="color:#94a3b8">${escapeHtml(labels[dataPointIndex] ?? '')}</div>
            ${lines || '<div style="color:#94a3b8">Sin datos</div>'}
            ${rows.length > 1 ? `<div style="display:flex;justify-content:space-between;border-top:1px solid #eef2ff;padding-top:6px;font-weight:700"><span>Total</span><span>${escapeHtml(format(total))}</span></div>` : ''}
          </div>`;
        },
      },
      xaxis: {
        categories: labels,
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: false },
        tooltip: { enabled: false },
        labels: {
          rotate: 0,
          hideOverlappingLabels: true,
          style: { colors: '#94a3b8', fontSize: '11px' },
        },
        tickAmount: Math.min(days.length, 10),
      },
      yaxis: {
        labels: {
          style: { colors: '#94a3b8', fontSize: '11px' },
          formatter: (v: number) => format(v),
        },
      },
    };
  });
}

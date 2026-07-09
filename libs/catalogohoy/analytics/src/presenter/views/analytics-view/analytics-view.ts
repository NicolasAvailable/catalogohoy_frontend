import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlanStore } from '@catalogohoy/plan';
import { AnalyticsStore } from '../../../infrastructure';
import { PageViewsPeriod } from '../../../domain';
import { IconComponent, PremiumUpgradePromptComponent } from '@ui';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-analytics-view',
  standalone: true,
  imports: [
    NgApexchartsModule,
    DecimalPipe,
    IconComponent,
    PremiumUpgradePromptComponent,
    TranslocoPipe,
  ],
  templateUrl: './analytics-view.html',
})
export class AnalyticsViewComponent {
  private readonly router = inject(Router);
  protected readonly analyticsStore = inject(AnalyticsStore);
  protected readonly planStore = inject(PlanStore);
  protected readonly pageViewsPeriod = signal<PageViewsPeriod>('today');

  constructor() {
    // Free plan users land on the upgrade prompt — don't burn analytics RPCs.
    if (!this.planStore.isFreePlan()) {
      this.analyticsStore.load();
    }
    this._initApexFix();
  }

  // ─── Chart: Page Views Overview (dark area) ──────────────────
  protected readonly chartPageViews = computed<ApexOptions>(() => ({
    chart: {
      animations: { speed: 400, animateGradually: { enabled: false } },
      fontFamily: 'inherit',
      foreColor: 'inherit',
      width: '100%',
      height: '100%',
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ['#818CF8'],
    dataLabels: { enabled: false },
    fill: { colors: ['#312E81'] },
    grid: {
      show: true,
      borderColor: '#334155',
      padding: { top: 10, bottom: -40, left: 0, right: 0 },
      position: 'back',
      xaxis: { lines: { show: true } },
    },
    series: this.analyticsStore.data()?.pageViews?.series?.[this.pageViewsPeriod()] ?? [],
    stroke: { width: 2 },
    tooltip: {
      followCursor: true,
      theme: 'dark',
      x: {
        formatter: (val: number) => {
          const d = new Date(val);
          const period = this.pageViewsPeriod();
          if (period === 'today') {
            const h = d.getUTCHours();
            if (h === 0) return '12:00 am';
            if (h === 12) return '12:00 pm';
            return h < 12 ? `${h}:00 am` : `${h - 12}:00 pm`;
          }
          if (period === 'one-month') return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
          return d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
        },
      },
      y: { formatter: (value: number) => `${value}` },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      crosshairs: { stroke: { color: '#475569', dashArray: 0, width: 2 } },
      labels: {
        offsetY: -20,
        style: { colors: '#CBD5E1' },
        rotate: 0,
        formatter: (value: string, timestamp?: number) => {
          const ts = timestamp ?? parseInt(value);
          if (!ts || isNaN(ts)) return value;
          const d = new Date(ts);
          const period = this.pageViewsPeriod();
          if (period === 'today') {
            const h = d.getUTCHours();
            if (h === 0) return '12 am';
            if (h === 12) return '12 pm';
            return h < 12 ? `${h} am` : `${h - 12} pm`;
          }
          if (period === 'one-month') return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
          return d.toLocaleDateString('es', { month: 'short', year: '2-digit' });
        },
      },
      tickAmount: this.pageViewsPeriod() === 'today' ? 12 : this.pageViewsPeriod() === 'one-month' ? 10 : 6,
      tooltip: { enabled: false },
      type: 'datetime',
    },
    yaxis: {
      axisTicks: { show: false },
      axisBorder: { show: false },
      min: (min: number) => min - 10,
      max: (max: number) => max + 5,
      tickAmount: 5,
      show: false,
    },
  }));


  // ─── Chart: Active Hours heatmap ─────────────────────────────
  protected readonly activeHoursMode = signal<'unique-users' | 'pageviews'>('unique-users');

  /**
   * Shifts a UTC 7×24 matrix to America/Caracas (UTC-4, no DST).
   * Events with utcHour < 4 cross midnight and belong to the previous day.
   */
  private _shiftMatrixToCaracas(utcMatrix: number[][]): number[][] {
    const OFFSET = -4; // America/Caracas = UTC-4
    const result: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const value = utcMatrix[day]?.[hour] ?? 0;
        if (value === 0) continue;
        const caracasHour = (hour + OFFSET + 24) % 24;
        const caracasDay = hour + OFFSET < 0 ? (day - 1 + 7) % 7 : day;
        result[caracasDay][caracasHour] += value;
      }
    }
    return result;
  }

  protected readonly chartActiveHours = computed<ApexOptions>(() => {
    const data = this.analyticsStore.data()?.activeHours;
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const rawMatrix =
      this.activeHoursMode() === 'unique-users'
        ? data?.byUniqueUsers
        : data?.byPageViews;

    const matrix = rawMatrix ? this._shiftMatrixToCaracas(rawMatrix) : undefined;

    // Reverse so Sun (index 0) renders at the top in ApexCharts heatmap
    const series = [...days].reverse().map((day, ri) => {
      const dayIndex = 6 - ri;
      return {
        name: day,
        data: Array.from({ length: 24 }, (_, h) => ({
          x: String(h),
          y: matrix?.[dayIndex]?.[h] ?? 0,
        })),
      };
    });

    return {
      chart: {
        animations: { enabled: false },
        fontFamily: 'inherit',
        height: '100%',
        type: 'heatmap',
        toolbar: { show: false },
      },
      colors: ['#6366f1'],
      dataLabels: {
        enabled: true,
        style: { fontSize: '10px', fontWeight: '400', colors: ['#fff'] },
        formatter: (val: number) => (val === 0 ? '' : String(val)),
      },
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.6,
          radius: 4,
          enableShades: true,
          colorScale: {
            ranges: [{ from: 0, to: 0, color: '#EEF2FF', name: '0' }],
          },
        },
      },
      series,
      stroke: { width: 2, colors: ['#fff'] },
      tooltip: {
        theme: 'dark',
        y: { formatter: (val: number) => String(val) },
      },
      xaxis: {
        type: 'category',
        labels: {
          style: { fontSize: '11px', colors: '#9ca3af' },
          formatter: (val: string) => {
            const h = parseInt(val);
            if (h === 0) return '12am';
            if (h === 12) return '12pm';
            return h < 12 ? `${h}am` : `${h - 12}pm`;
          },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: { style: { fontSize: '11px', colors: '#9ca3af' } },
      },
      legend: { show: false },
    };
  });

  // ─── Donut base config ────────────────────────────────────────
  private _donutConfig(
    colors: string[],
    labels: string[],
    series: number[]
  ): ApexOptions {
    return {
      chart: {
        animations: { speed: 400, animateGradually: { enabled: false } },
        fontFamily: 'inherit',
        foreColor: 'inherit',
        height: '100%',
        type: 'donut',
        sparkline: { enabled: true },
      },
      colors,
      labels,
      plotOptions: {
        pie: {
          customScale: 0.9,
          expandOnClick: false,
          donut: { size: '70%' },
        },
      },
      series,
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } },
      },
      tooltip: {
        enabled: true,
        fillSeriesColor: false,
        theme: 'dark',
        custom: ({ seriesIndex, w }: any) =>
          `<div class="flex items-center h-8 min-h-8 max-h-8 px-3">
            <div class="w-3 h-3 rounded-full" style="background-color: ${w.config.colors[seriesIndex]};"></div>
            <div class="ml-2 text-md leading-none">${w.config.labels[seriesIndex]}:</div>
            <div class="ml-2 text-md font-bold leading-none">${w.config.series[seriesIndex]}%</div>
          </div>`,
      },
    };
  }

  private _palette(base: string[], labels: string[]): string[] {
    return base.slice(0, Math.max(labels.length, 1));
  }

  protected readonly chartBrowser = computed<ApexOptions>(() => {
    const d = this.analyticsStore.data()?.browser;
    if (!d?.labels.length) return this._donutConfig(['#3182CE'], ['Sin datos'], [100]);
    return this._donutConfig(
      this._palette(['#3182CE', '#63B3ED', '#90CDF4', '#4299E1', '#BEE3F8'], d.labels),
      d.labels,
      d.series
    );
  });

  protected readonly chartOs = computed<ApexOptions>(() => {
    const d = this.analyticsStore.data()?.os;
    if (!d?.labels.length) return this._donutConfig(['#319795'], ['Sin datos'], [100]);
    return this._donutConfig(
      this._palette(['#319795', '#4FD1C5', '#81E6D9', '#2C7A7B', '#234E52'], d.labels),
      d.labels,
      d.series
    );
  });

  protected readonly chartDevice = computed<ApexOptions>(() => {
    const d = this.analyticsStore.data()?.device;
    if (!d?.labels.length) return this._donutConfig(['#DD6B20'], ['Sin datos'], [100]);
    return this._donutConfig(
      this._palette(['#DD6B20', '#F6AD55', '#FBD38D'], d.labels),
      d.labels,
      d.series
    );
  });

  protected readonly chartLanguage = computed<ApexOptions>(() => {
    const d = this.analyticsStore.data()?.language;
    if (!d?.labels.length) return this._donutConfig(['#805AD5'], ['Sin datos'], [100]);
    return this._donutConfig(
      this._palette(['#805AD5', '#B794F4', '#D6BCFA', '#9F7AEA', '#6B46C1'], d.labels),
      d.labels,
      d.series
    );
  });

  // ─── SVG fill fix (required with Angular <base href>) ────────
  private _initApexFix(): void {
    (window as any)['Apex'] = {
      chart: {
        events: {
          mounted: (chart: any) => this._fixSvgFill(chart.el),
          updated: (chart: any) => this._fixSvgFill(chart.el),
        },
      },
    };
  }

  private _fixSvgFill(element: Element): void {
    const currentURL = this.router.url;
    Array.from(element.querySelectorAll('*[fill]'))
      .filter((el) => el.getAttribute('fill')!.includes('url('))
      .forEach((el) => {
        const attrVal = el.getAttribute('fill')!;
        el.setAttribute(
          'fill',
          `url(${currentURL}${attrVal.slice(attrVal.indexOf('#'))}`
        );
      });
  }
}

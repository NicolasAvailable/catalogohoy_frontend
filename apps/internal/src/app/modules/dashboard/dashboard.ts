import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { IconComponent } from '@ui';
import { RevenuePoint } from './revenue.service';
import { RevenueStore } from './revenue.store';

interface SummaryCard {
  label: string;
  value: string;
  icon: string;
  hint: string;
  tone: 'primary' | 'success' | 'warning' | 'info';
}

type ChartType = 'bar' | 'area';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgApexchartsModule, CurrencyPipe, DecimalPipe],
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold text-grey-700">Panel interno</h1>
        <p class="text-sm text-grey-400">
          Resumen general del estado de la plataforma CatalogoHoy
        </p>
      </header>

      <!-- Charts: MRR + ARR -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- MRR (normalized) -->
        <article
          class="flex flex-col bg-white rounded-xl border border-grey-50 overflow-hidden"
        >
          <div class="flex flex-col p-5 pb-3 gap-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-col">
                <span class="text-sm font-medium text-grey-400">MRR</span>
                <span class="text-xs text-grey-300">
                  Ingreso mensual recurrente normalizado
                </span>
              </div>
              <div
                class="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50"
              >
                <ui-icon
                  name="trending-up"
                  size="18"
                  styleClass="text-emerald-500"
                />
              </div>
            </div>
            <div class="flex items-end gap-4">
              <strong class="text-3xl md:text-4xl font-bold text-grey-700 tracking-tight leading-none">
                {{ revenue.currentMrr() | currency: 'USD' : 'symbol' : '1.2-2' }}
              </strong>
              <span
                class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
                [class.bg-emerald-50]="revenue.mrrGrowthPct() >= 0"
                [class.text-emerald-600]="revenue.mrrGrowthPct() >= 0"
                [class.bg-red-50]="revenue.mrrGrowthPct() < 0"
                [class.text-red-600]="revenue.mrrGrowthPct() < 0"
              >
                <ui-icon
                  [name]="revenue.mrrGrowthPct() >= 0 ? 'arrow-up-right' : 'arrow-down-right'"
                  size="12"
                  [styleClass]="revenue.mrrGrowthPct() >= 0 ? 'text-emerald-500' : 'text-red-500'"
                />
                {{ revenue.mrrGrowthPct() | number: '1.1-1' }}%
              </span>
            </div>
          </div>
          <div class="flex-1 min-h-40">
            @if (hasSeries()) {
              <apx-chart
                class="block w-full h-40"
                [chart]="mrrOptions().chart!"
                [colors]="mrrOptions().colors!"
                [fill]="mrrOptions().fill!"
                [series]="mrrOptions().series!"
                [stroke]="mrrOptions().stroke!"
                [tooltip]="mrrOptions().tooltip!"
                [xaxis]="mrrOptions().xaxis!"
                [dataLabels]="mrrOptions().dataLabels!"
              />
            }
          </div>
        </article>

        <!-- ARR (projected) -->
        <article
          class="flex flex-col bg-white rounded-xl border border-grey-50 overflow-hidden"
        >
          <div class="flex flex-col p-5 pb-3 gap-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-col">
                <span class="text-sm font-medium text-grey-400">ARR</span>
                <span class="text-xs text-grey-300">
                  Proyección anual (MRR × 12)
                </span>
              </div>
              <div
                class="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-50"
              >
                <ui-icon
                  name="calendar-days"
                  size="18"
                  styleClass="text-sky-500"
                />
              </div>
            </div>
            <div class="flex items-end gap-4">
              <strong class="text-3xl md:text-4xl font-bold text-grey-700 tracking-tight leading-none">
                {{ revenue.currentArr() | currency: 'USD' : 'symbol' : '1.2-2' }}
              </strong>
              <span class="text-xs text-grey-400">
                {{ revenue.currentActiveSubs() }} subs activas
              </span>
            </div>
          </div>
          <div class="flex-1 min-h-40">
            @if (hasSeries()) {
              <apx-chart
                class="block w-full h-40"
                [chart]="arrOptions().chart!"
                [colors]="arrOptions().colors!"
                [fill]="arrOptions().fill!"
                [series]="arrOptions().series!"
                [stroke]="arrOptions().stroke!"
                [tooltip]="arrOptions().tooltip!"
                [xaxis]="arrOptions().xaxis!"
                [dataLabels]="arrOptions().dataLabels!"
              />
            }
          </div>
        </article>
      </section>

      <section
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        @for (card of cards(); track card.label) {
          <article
            class="flex flex-col gap-3 p-5 bg-white rounded-xl border border-grey-50"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-grey-400">
                {{ card.label }}
              </span>
              <div
                class="flex items-center justify-center w-9 h-9 rounded-lg"
                [class.bg-primary-50]="card.tone === 'primary'"
                [class.bg-emerald-50]="card.tone === 'success'"
                [class.bg-amber-50]="card.tone === 'warning'"
                [class.bg-sky-50]="card.tone === 'info'"
              >
                <ui-icon
                  [name]="card.icon"
                  size="18"
                  [styleClass]="
                    card.tone === 'primary'
                      ? 'text-primary-500'
                      : card.tone === 'success'
                      ? 'text-emerald-500'
                      : card.tone === 'warning'
                      ? 'text-amber-500'
                      : 'text-sky-500'
                  "
                />
              </div>
            </div>
            <strong class="text-3xl font-bold text-grey-700">
              {{ card.value }}
            </strong>
            <span class="text-xs text-grey-400">{{ card.hint }}</span>
          </article>
        }
      </section>

      <section class="bg-white rounded-xl border border-grey-50 p-6">
        <h2 class="text-base font-semibold text-grey-700 mb-4">
          Bienvenido al sistema interno
        </h2>
        <p class="text-sm text-grey-400 leading-relaxed">
          Desde acá podés gestionar los planes (mensual, trimestral y anual),
          ver los usuarios registrados y administrar los clientes que pagaron
          una suscripción.
        </p>
      </section>
    </div>
  `,
})
export class Dashboard implements OnInit {
  protected readonly revenue = inject(RevenueStore);

  protected readonly hasSeries = computed(
    () => this.revenue.points().length > 0
  );

  protected readonly mrrOptions = computed<ApexOptions>(() =>
    this.buildChart(
      'area',
      'MRR',
      this.pointsAs((p) => p.mrrNormalized),
      '#10B981',
      '#D1FAE5'
    )
  );

  protected readonly arrOptions = computed<ApexOptions>(() =>
    this.buildChart(
      'area',
      'ARR',
      this.pointsAs((p) => p.arrProjected),
      '#0EA5E9',
      '#E0F2FE'
    )
  );

  protected readonly cards = computed<SummaryCard[]>(() => [
    {
      label: 'Cobrado este mes',
      value: this.formatCurrency(this.revenue.currentCashReceived()),
      icon: 'banknote',
      hint: `${this.revenue.currentNewSubs()} suscripciones nuevas`,
      tone: 'warning',
    },
    {
      label: 'MRR actual',
      value: this.formatCurrency(this.revenue.currentMrr()),
      icon: 'trending-up',
      hint: 'Ingreso mensual recurrente (normalizado)',
      tone: 'success',
    },
    {
      label: 'ARR proyectado',
      value: this.formatCurrency(this.revenue.currentArr()),
      icon: 'calendar-days',
      hint: 'MRR × 12',
      tone: 'info',
    },
    {
      label: 'Suscripciones activas',
      value: String(this.revenue.currentActiveSubs()),
      icon: 'check-circle',
      hint: 'Catálogos con plan pago vigente',
      tone: 'primary',
    },
  ]);

  ngOnInit(): void {
    this.revenue.load(12);
  }

  private pointsAs(
    select: (p: RevenuePoint) => number
  ): { x: number; y: number }[] {
    return this.revenue.points().map((p) => ({
      x: new Date(p.monthStart).getTime(),
      y: Number(select(p).toFixed(2)),
    }));
  }

  private buildChart(
    type: ChartType,
    name: string,
    data: { x: number; y: number }[],
    strokeColor: string,
    fillColor: string
  ): ApexOptions {
    return {
      chart: {
        type,
        height: '100%',
        width: '100%',
        fontFamily: 'inherit',
        foreColor: 'inherit',
        toolbar: { show: false },
        sparkline: { enabled: true },
        animations: { speed: 400, animateGradually: { enabled: false } },
      },
      colors: [strokeColor],
      fill: {
        colors: [fillColor],
        opacity: type === 'bar' ? 0.95 : 0.6,
        type: 'solid',
      },
      dataLabels: { enabled: false },
      series: [{ name, data }],
      stroke:
        type === 'bar'
          ? { show: true, width: 1, colors: [strokeColor] }
          : { curve: 'smooth', width: 2 },
      plotOptions: {
        bar: {
          columnWidth: '55%',
          borderRadius: 3,
          borderRadiusApplication: 'end',
        },
      },
      tooltip: {
        followCursor: true,
        theme: 'dark',
        x: { format: 'MMM yyyy' },
        y: {
          formatter: (value: number): string => this.formatCurrency(value),
        },
      },
      xaxis: { type: 'datetime' },
    };
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

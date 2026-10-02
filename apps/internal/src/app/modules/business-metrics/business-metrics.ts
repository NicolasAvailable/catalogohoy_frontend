import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { IconComponent } from '@ui';
import { BusinessMetricsStore } from './business-metrics.store';

@Component({
  selector: 'app-business-metrics',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, PercentPipe, IconComponent],
  host: { class: 'flex-1 min-h-0 flex flex-col overflow-auto' },
  template: `
    <div class="p-6 flex flex-col gap-6 max-w-[80rem] w-full mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Métricas de negocio</h1>
          <p class="text-sm text-slate-500">
            Ingresos, crecimiento y margen — de Stripe, la base y los gastos.
          </p>
        </div>
        <button
          (click)="store.load()"
          [disabled]="store.isLoading()"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ui-icon name="refresh-cw" [size]="16" [styleClass]="store.isLoading() ? 'animate-spin' : ''" />
          Actualizar
        </button>
      </div>

      @if (store.error(); as err) {
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>No se pudieron cargar las métricas:</strong> {{ err }}
        </div>
      }

      @if (store.isLoading() && !m()) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          @for (i of [1,2,3,4,5,6,7,8]; track i) {
            <div class="h-28 rounded-xl border border-slate-100 bg-white animate-pulse"></div>
          }
        </div>
      } @else if (m(); as b) {
        <!-- ══ Ingresos ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Ingresos</h2>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="kpi">
              <div class="kpi-ico bg-indigo-50 text-indigo-600"><ui-icon name="repeat" [size]="20" /></div>
              <p class="kpi-label">MRR</p>
              <p class="kpi-value">{{ b.mrrUsd | currency:'USD':'symbol':'1.0-0' }}</p>
              <p class="kpi-sub">ingreso recurrente mensual</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-violet-50 text-violet-600"><ui-icon name="calendar" [size]="20" /></div>
              <p class="kpi-label">ARR proyectado</p>
              <p class="kpi-value">{{ b.arrUsd | currency:'USD':'symbol':'1.0-0' }}</p>
              <p class="kpi-sub">MRR × 12</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-emerald-50 text-emerald-600"><ui-icon name="dollar-sign" [size]="20" /></div>
              <p class="kpi-label">Cobrado este mes</p>
              <p class="kpi-value">{{ b.collectedThisMonthUsd | currency:'USD':'symbol':'1.0-0' }}</p>
              <p class="kpi-sub">Stripe + manual</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-sky-50 text-sky-600"><ui-icon name="user-round" [size]="20" /></div>
              <p class="kpi-label">ARPA</p>
              <p class="kpi-value">{{ b.arpaUsd | currency:'USD':'symbol':'1.2-2' }}</p>
              <p class="kpi-sub">{{ b.payingCount }} catálogos pagos</p>
            </div>
          </div>
        </section>

        <!-- ══ Crecimiento ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Crecimiento</h2>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="kpi">
              <div class="kpi-ico bg-blue-50 text-blue-600"><ui-icon name="user-plus" [size]="20" /></div>
              <p class="kpi-label">Altas de catálogos (mes)</p>
              <div class="flex items-baseline gap-2">
                <p class="kpi-value">{{ b.signups.thisMonth | number }}</p>
                <span [class]="deltaClass(b.signups.thisMonth, b.signups.prevMonth)">
                  {{ deltaLabel(b.signups.thisMonth, b.signups.prevMonth) }}
                </span>
              </div>
              <p class="kpi-sub">mes anterior: {{ b.signups.prevMonth | number }}</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-teal-50 text-teal-600"><ui-icon name="store" [size]="20" /></div>
              <p class="kpi-label">Comercios activos (mes)</p>
              <div class="flex items-baseline gap-2">
                <p class="kpi-value">{{ b.activeMerchants.thisMonth | number }}</p>
                <span [class]="deltaClass(b.activeMerchants.thisMonth, b.activeMerchants.prevMonth)">
                  {{ deltaLabel(b.activeMerchants.thisMonth, b.activeMerchants.prevMonth) }}
                </span>
              </div>
              <p class="kpi-sub">con órdenes en el mes · prev: {{ b.activeMerchants.prevMonth | number }}</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-amber-50 text-amber-600"><ui-icon name="layers" [size]="20" /></div>
              <p class="kpi-label">Mix de planes</p>
              <div class="flex flex-col gap-1.5 mt-1 w-full">
                @for (p of b.planMix; track p.planId) {
                  <div class="flex items-center gap-2 text-xs">
                    <span class="w-20 shrink-0 text-slate-600 font-medium">{{ planLabel(p.planId) }}</span>
                    <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div class="h-full rounded-full bg-amber-400" [style.width.%]="barPct(p.count, b.payingCount)"></div>
                    </div>
                    <span class="w-8 text-right tabular-nums text-slate-700 font-semibold">{{ p.count }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </section>

        <!-- ══ Costos & Margen ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Costos &amp; margen</h2>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="kpi">
              <div class="kpi-ico bg-rose-50 text-rose-600"><ui-icon name="wallet" [size]="20" /></div>
              <p class="kpi-label">OpEx mensual</p>
              <p class="kpi-value">{{ b.opexMonthlyUsd | currency:'USD':'symbol':'1.0-0' }}</p>
              <p class="kpi-sub">gastos de la empresa</p>
            </div>
            <div class="kpi lg:col-span-2">
              <div class="kpi-ico bg-green-50 text-green-600"><ui-icon name="trending-up" [size]="20" /></div>
              <p class="kpi-label">Margen de contribución (aprox)</p>
              <div class="flex items-baseline gap-2">
                <p class="kpi-value" [class.text-green-600]="b.contributionMarginUsd >= 0" [class.text-red-600]="b.contributionMarginUsd < 0">
                  {{ b.contributionMarginUsd | currency:'USD':'symbol':'1.0-0' }}
                </p>
                <span class="text-sm font-semibold text-slate-500">
                  {{ b.contributionMarginPct | percent:'1.0-0' }}
                </span>
              </div>
              <p class="kpi-sub">MRR − OpEx · falta sumar WhatsApp, IA y fees de Stripe</p>
            </div>
          </div>
          <p class="text-xs text-slate-400">
            ⓘ El margen/EBITDA es aproximado por ahora: todavía no entran el costo de WhatsApp (Meta),
            IA (en USD) ni las comisiones de Stripe. Esas fuentes se suman en la próxima etapa.
          </p>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .kpi {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        background: #fff;
        border: 1px solid #f1f5f9;
        border-radius: 0.75rem;
        padding: 1.1rem 1.2rem;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }
      .kpi-ico {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.6rem;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.4rem;
      }
      .kpi-label {
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #94a3b8;
        margin: 0;
      }
      .kpi-value {
        font-size: 1.6rem;
        font-weight: 700;
        color: #1e293b;
        margin: 0;
        line-height: 1.1;
      }
      .kpi-sub {
        font-size: 0.72rem;
        color: #94a3b8;
        margin: 0;
      }
    `,
  ],
})
export class BusinessMetrics implements OnInit {
  protected readonly store = inject(BusinessMetricsStore);
  protected readonly m = computed(() => this.store.metrics());

  ngOnInit(): void {
    this.store.load();
  }

  protected planLabel(id: string): string {
    const map: Record<string, string> = {
      gratis: 'Gratis',
      basico: 'Básico',
      pro: 'Pro',
      avanzado: 'Avanzado',
      enterprise: 'Enterprise',
    };
    return map[id] ?? id;
  }

  protected barPct(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
  }

  private momPct(cur: number, prev: number): number {
    if (!prev) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  }

  protected deltaLabel(cur: number, prev: number): string {
    const pct = this.momPct(cur, prev);
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(0)}%`;
  }

  protected deltaClass(cur: number, prev: number): string {
    const pct = this.momPct(cur, prev);
    const base = 'text-xs font-semibold px-1.5 py-0.5 rounded-md ';
    if (pct > 0) return base + 'text-emerald-700 bg-emerald-50';
    if (pct < 0) return base + 'text-red-700 bg-red-50';
    return base + 'text-slate-500 bg-slate-100';
  }
}

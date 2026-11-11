import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Component, computed, inject, OnInit } from '@angular/core';
import { IconComponent } from '@ui';
import { TopPayer } from '../dashboard/live-metrics.service';
import { SignupConversion } from './business-metrics.model';
import { BusinessMetricsStore } from './business-metrics.store';

@Component({
  selector: 'app-business-metrics',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, PercentPipe, IconComponent, RouterLink],
  host: { class: 'flex-1 min-h-0 flex flex-col overflow-auto' },
  template: `
    <div class="p-6 flex flex-col gap-6 max-w-[80rem] w-full mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Métricas de negocio</h1>
          <p class="text-sm text-slate-500">
            Ingresos, crecimiento y margen — de Stripe, la base y los gastos.
            @if (m()?.demoTenants?.length) {
              <span class="text-amber-600">· Sin {{ m()!.demoTenants.length }} cuentas demo.</span>
            }
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
              <p class="kpi-sub">ingreso promedio por catálogo pago ({{ b.payingCount }}) · no es ganancia</p>
            </div>
          </div>
        </section>

        <!-- ══ Clientes que pagan más ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Clientes que pagan más</h2>
          <div class="kpi !p-0 overflow-hidden">
            @if (b.topPayers.length === 0) {
              <p class="p-4 text-sm text-slate-500">Sin datos todavía.</p>
            } @else {
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-[0.7rem] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th class="px-4 py-2 font-semibold">#</th>
                    <th class="px-4 py-2 font-semibold">Catálogo</th>
                    <th class="px-4 py-2 font-semibold hidden sm:table-cell">Plan</th>
                    <th class="px-4 py-2 font-semibold">Cobro</th>
                    <th class="px-4 py-2 font-semibold text-right">Por mes</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of b.topPayers; track $index; let i = $index) {
                    <tr class="border-b border-slate-50 last:border-0">
                      <td class="px-4 py-2 text-slate-400 tabular-nums">{{ i + 1 }}</td>
                      <td class="px-4 py-2">
                        @if (p.tenantId) {
                          <a [routerLink]="['/tenants', p.tenantId]" class="font-medium text-slate-800 hover:underline">{{ p.name }}</a>
                        } @else {
                          <span class="font-medium text-slate-800">{{ p.name }}</span>
                          <span class="text-xs text-slate-400"> (sin catálogo ligado)</span>
                        }
                        @if (p.slug) {
                          <span class="block text-xs text-slate-400">{{ p.slug }}</span>
                        }
                      </td>
                      <td class="px-4 py-2 text-slate-600 hidden sm:table-cell">{{ p.planId ? planLabel(p.planId) : '—' }}</td>
                      <td class="px-4 py-2">
                        <span [class]="sourceClass(p.source)">{{ sourceLabel(p.source) }}</span>
                      </td>
                      <td class="px-4 py-2 text-right font-semibold tabular-nums text-slate-800">
                        {{ p.mrrUsd | currency:'USD':'symbol':'1.2-2' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
          <p class="text-xs text-slate-400">
            ⓘ Stripe = precio real de la suscripción (anual ÷ 12). Manual = monto que registraste al asignar el plan
            (si no hay monto, precio de lista). MRR: Stripe {{ b.stripeMrrUsd | currency:'USD':'symbol':'1.0-0' }}
            · manual/apps {{ b.manualMrrUsd | currency:'USD':'symbol':'1.0-0' }}.
          </p>
        </section>

        <!-- ══ Registros por día ══ -->
        @if (b.conversion; as c) {
          @let r = signupStats(c);
          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Registros por día (hora Venezuela)</h2>
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div class="kpi ring-1 ring-slate-200">
                <div class="kpi-ico bg-blue-50 text-blue-600"><ui-icon name="user-plus" [size]="20" /></div>
                <p class="kpi-label">Hoy</p>
                <p class="kpi-value">{{ r.today | number }}</p>
                <p class="kpi-sub">en lo que va del día</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-slate-100 text-slate-700"><ui-icon name="calendar" [size]="20" /></div>
                <p class="kpi-label">Ayer</p>
                <p class="kpi-value">{{ r.yesterday | number }}</p>
                <p class="kpi-sub">día completo</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-indigo-50 text-indigo-600"><ui-icon name="trending-up" [size]="20" /></div>
                <p class="kpi-label">Promedio 7 días</p>
                <p class="kpi-value">{{ r.avg7 | number:'1.0-1' }}</p>
                <span [class]="deltaClass(r.avg7, r.avgPrev7)">{{ deltaLabel(r.avg7, r.avgPrev7) }}</span>
                <p class="kpi-sub">por día · semana anterior {{ r.avgPrev7 | number:'1.0-1' }}</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-violet-50 text-violet-600"><ui-icon name="trending-up" [size]="20" /></div>
                <p class="kpi-label">Promedio 30 días</p>
                <p class="kpi-value">{{ r.avg30 | number:'1.0-1' }}</p>
                <p class="kpi-sub">por día (sin contar hoy)</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-emerald-50 text-emerald-600"><ui-icon name="trophy" [size]="20" /></div>
                <p class="kpi-label">Mejor día</p>
                <p class="kpi-value">{{ r.best.signups | number }}</p>
                <p class="kpi-sub">{{ dayLabel(r.best.day) }}</p>
              </div>
            </div>
          </section>
        }

        <!-- ══ Conversión registro → pago ══ -->
        @if (b.conversion; as c) {
          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Conversión registro → pago (últimos {{ c.days }} días)</h2>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="kpi">
                <div class="kpi-ico bg-blue-50 text-blue-600"><ui-icon name="user-plus" [size]="20" /></div>
                <p class="kpi-label">Se registraron</p>
                <p class="kpi-value">{{ c.signups | number }}</p>
                <p class="kpi-sub">~{{ c.signups / c.days | number:'1.0-0' }} por día</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-emerald-50 text-emerald-600"><ui-icon name="dollar-sign" [size]="20" /></div>
                <p class="kpi-label">Ya pagan</p>
                <p class="kpi-value">{{ c.converted | number }}</p>
                <p class="kpi-sub">de esos registros</p>
              </div>
              <div class="kpi ring-1 ring-slate-200">
                <div class="kpi-ico bg-slate-100 text-slate-700"><ui-icon name="target" [size]="20" /></div>
                <p class="kpi-label">Convierte</p>
                <p class="kpi-value">{{ c.converted > 0 ? '1 de cada ' + (c.signups / c.converted | number:'1.0-0') : '—' }}</p>
                <p class="kpi-sub">{{ pct(c.converted, c.signups) | number:'1.1-1' }}% de los que se registran</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-indigo-50 text-indigo-600"><ui-icon name="calendar" [size]="20" /></div>
                <p class="kpi-label">Últimos 7 días</p>
                <p class="kpi-value">{{ last7(c).converted }} / {{ last7(c).signups }}</p>
                <p class="kpi-sub">pagan / se registraron</p>
              </div>
            </div>
            <div class="kpi">
              <p class="kpi-label">Por día · barra = registros · verde = ya pagan</p>
              <div class="flex items-end gap-[3px] h-36 mt-2">
                @for (d of c.series; track d.day) {
                  <div class="flex-1 h-full flex flex-col justify-end items-center" [title]="dayLabel(d.day) + ': ' + d.signups + ' registros, ' + d.converted + ' pagan'">
                    <span class="text-[0.6rem] leading-none text-slate-500 mb-0.5">{{ d.signups }}</span>
                    <div class="w-full rounded-t bg-slate-200 relative" [style.height.%]="barPct(d.signups, maxSignups(c))">
                      <div class="absolute bottom-0 left-0 right-0 rounded-t bg-emerald-500" [style.height.%]="barPct(d.converted, d.signups)"></div>
                    </div>
                  </div>
                }
              </div>
              <div class="flex justify-between text-[0.65rem] text-slate-400 mt-1">
                <span>{{ dayLabel(c.series[0]?.day) }}</span>
                <span>hoy</span>
              </div>
              <p class="kpi-sub mt-1">
                "Ya pagan" = el usuario tiene un catálogo que hoy paga o pagó algún mes. Los registros de días
                recientes todavía pueden convertir, así que esos días se ven más bajos.
              </p>
            </div>
          </section>
        }

        <!-- ══ Churn ══ -->
        @if (b.churn?.thisMonth; as ch) {
          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Churn (catálogos que dejaron de pagar)</h2>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="kpi ring-1 ring-slate-200">
                <div class="kpi-ico bg-red-50 text-red-600"><ui-icon name="user-minus" [size]="20" /></div>
                <p class="kpi-label">Este mes (hasta hoy)</p>
                <p class="kpi-value" [class.text-red-600]="ch.churnRatePct >= 5">{{ ch.churnRatePct | number:'1.1-1' }}%</p>
                <p class="kpi-sub">{{ ch.churnedCount }} de {{ ch.startCount }} que pagaban el 1° ya no pagan</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-red-50 text-red-600"><ui-icon name="trending-down" [size]="20" /></div>
                <p class="kpi-label">MRR perdido este mes</p>
                <p class="kpi-value text-red-600">−{{ ch.lostMrr | currency:'USD':'symbol':'1.0-0' }}</p>
                <p class="kpi-sub">de {{ ch.startMrr ?? 0 | currency:'USD':'symbol':'1.0-0' }} al inicio del mes</p>
              </div>
              @if (b.churn?.lastMonth; as lm) {
                <div class="kpi">
                  <div class="kpi-ico bg-slate-100 text-slate-600"><ui-icon name="calendar" [size]="20" /></div>
                  <p class="kpi-label">Mes pasado (cerrado)</p>
                  <p class="kpi-value">{{ lm.churnRatePct | number:'1.1-1' }}%</p>
                  <p class="kpi-sub">{{ lm.churnedCount }} de {{ lm.startCount }} · −{{ lm.lostMrr | currency:'USD':'symbol':'1.0-0' }} MRR</p>
                </div>
              }
              <div class="kpi">
                <div class="kpi-ico bg-emerald-50 text-emerald-600"><ui-icon name="check-circle" [size]="20" /></div>
                <p class="kpi-label">Retención este mes</p>
                <p class="kpi-value text-emerald-600">{{ 100 - ch.churnRatePct | number:'1.1-1' }}%</p>
                <p class="kpi-sub">siguen pagando</p>
              </div>
            </div>
            @if (ch.churned?.length) {
              <details class="kpi">
                <summary class="cursor-pointer text-sm font-medium text-slate-700">
                  Ver los {{ ch.churned!.length }} catálogos que dejaron de pagar este mes
                </summary>
                <ul class="mt-2 flex flex-col divide-y divide-slate-50">
                  @for (t of ch.churned; track t.tenantId) {
                    <li class="flex items-center justify-between py-1.5 text-sm">
                      <a [routerLink]="['/tenants', t.tenantId]" class="text-slate-700 hover:underline">{{ t.name ?? t.slug }}</a>
                      <span class="text-slate-500 tabular-nums">{{ planLabel(t.planId) }} · {{ t.mrrUsd | currency:'USD':'symbol':'1.2-2' }}</span>
                    </li>
                  }
                </ul>
              </details>
            }
            <p class="text-xs text-slate-400">
              ⓘ Churn = de los catálogos que pagaban en la foto del día 1, cuántos ya no tienen plan pago vigente.
              Incluye trials que no pagaron. No cuenta cuentas demo.
            </p>
          </section>
        }

        <!-- ══ Crecimiento ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Crecimiento</h2>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="kpi">
              <div class="kpi-ico bg-blue-50 text-blue-600"><ui-icon name="user-plus" [size]="20" /></div>
              <p class="kpi-label">Altas de catálogos (mes)</p>
              <div class="flex items-baseline gap-2">
                <p class="kpi-value">{{ b.signups.thisMonth | number }}</p>
                <span [class]="deltaClass(b.signups.thisMonth, b.signups.prevMonthToDate)">
                  {{ deltaLabel(b.signups.thisMonth, b.signups.prevMonthToDate) }}
                </span>
              </div>
              <p class="kpi-sub">vs mismo día mes pasado: {{ b.signups.prevMonthToDate | number }} · mes completo: {{ b.signups.prevMonth | number }}</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-teal-50 text-teal-600"><ui-icon name="store" [size]="20" /></div>
              <p class="kpi-label">Comercios activos (mes)</p>
              <div class="flex items-baseline gap-2">
                <p class="kpi-value">{{ b.activeMerchants.thisMonth | number }}</p>
                <span [class]="deltaClass(b.activeMerchants.thisMonth, b.activeMerchants.prevMonthToDate)">
                  {{ deltaLabel(b.activeMerchants.thisMonth, b.activeMerchants.prevMonthToDate) }}
                </span>
              </div>
              <p class="kpi-sub">con órdenes · vs mismo día mes pasado: {{ b.activeMerchants.prevMonthToDate | number }}</p>
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

        <!-- ══ Volumen & retención ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Volumen &amp; retención</h2>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="kpi">
              <div class="kpi-ico bg-cyan-50 text-cyan-600"><ui-icon name="shopping-bag" [size]="20" /></div>
              <p class="kpi-label">GMV (catálogos en USD)</p>
              <p class="kpi-value">{{ b.gmvUsd | currency:'USD':'symbol':'1.0-0' }}</p>
              <p class="kpi-sub">no incluye catálogos en otra moneda</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-orange-50 text-orange-600"><ui-icon name="shopping-bag" [size]="20" /></div>
              <p class="kpi-label">Órdenes completadas</p>
              <p class="kpi-value">{{ b.completedOrders | number }}</p>
              <p class="kpi-sub">histórico de la plataforma</p>
            </div>
            @if (!b.churn?.thisMonth) {
              <div class="kpi">
                <div class="kpi-ico bg-red-50 text-red-600"><ui-icon name="trending-down" [size]="20" /></div>
                <p class="kpi-label">Churn mensual</p>
                <p class="kpi-value" [class.text-red-600]="b.churnRatePct >= 5">{{ b.churnRatePct | number:'1.1-1' }}%</p>
                <p class="kpi-sub">catálogos de pago (mes en curso)</p>
              </div>
            }
          </div>
        </section>

        <!-- ══ Movimiento de MRR (NRR) ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Movimiento de MRR &amp; retención por dólar</h2>
          @if (b.movement.ready) {
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div class="kpi">
                <div class="kpi-ico bg-emerald-50 text-emerald-600"><ui-icon name="trending-up" [size]="20" /></div>
                <p class="kpi-label">Nuevo</p>
                <p class="kpi-value text-emerald-600">+{{ b.movement.newMrr | currency:'USD':'symbol':'1.0-0' }}</p>
                <p class="kpi-sub">altas del mes</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-green-50 text-green-600"><ui-icon name="trending-up" [size]="20" /></div>
                <p class="kpi-label">Expansión</p>
                <p class="kpi-value text-green-600">+{{ b.movement.expansionMrr | currency:'USD':'symbol':'1.0-0' }}</p>
                <p class="kpi-sub">upgrades</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-amber-50 text-amber-600"><ui-icon name="trending-down" [size]="20" /></div>
                <p class="kpi-label">Contracción</p>
                <p class="kpi-value text-amber-600">−{{ b.movement.contractionMrr | currency:'USD':'symbol':'1.0-0' }}</p>
                <p class="kpi-sub">downgrades</p>
              </div>
              <div class="kpi">
                <div class="kpi-ico bg-red-50 text-red-600"><ui-icon name="trending-down" [size]="20" /></div>
                <p class="kpi-label">Churn</p>
                <p class="kpi-value text-red-600">−{{ b.movement.churnedMrr | currency:'USD':'symbol':'1.0-0' }}</p>
                <p class="kpi-sub">bajas del mes</p>
              </div>
              <div class="kpi ring-1 ring-slate-200">
                <div class="kpi-ico bg-slate-100 text-slate-700"><ui-icon name="repeat" [size]="20" /></div>
                <p class="kpi-label">NRR</p>
                <p class="kpi-value" [class.text-emerald-600]="(b.movement.nrrPct ?? 0) >= 100" [class.text-red-600]="(b.movement.nrrPct ?? 0) < 100">{{ b.movement.nrrPct | number:'1.0-1' }}%</p>
                <p class="kpi-sub">retención neta de ingresos</p>
              </div>
            </div>
          } @else {
            <div class="kpi">
              <div class="kpi-ico bg-slate-100 text-slate-500"><ui-icon name="repeat" [size]="20" /></div>
              <p class="kpi-label">Acumulando</p>
              <p class="text-sm text-slate-600">
                El movimiento de MRR y la NRR necesitan 2 meses de fotos.
                Ya guardamos la de este mes; aparecen con la del próximo.
              </p>
              <p class="kpi-sub">snapshots guardados: {{ b.movement.snapshots ?? 1 }}</p>
            </div>
          }
        </section>

        <!-- ══ Prueba gratis (trial) ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Prueba gratis (7 días)</h2>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="kpi">
              <div class="kpi-ico bg-indigo-50 text-indigo-600"><ui-icon name="user-plus" [size]="20" /></div>
              <p class="kpi-label">Iniciaron prueba</p>
              <p class="kpi-value">{{ b.trialFunnel.started | number }}</p>
              <p class="kpi-sub">desde que se mide</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-amber-50 text-amber-600"><ui-icon name="calendar" [size]="20" /></div>
              <p class="kpi-label">En prueba ahora</p>
              <p class="kpi-value">{{ b.trialFunnel.inTrial | number }}</p>
              <p class="kpi-sub">trial activo</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-emerald-50 text-emerald-600"><ui-icon name="dollar-sign" [size]="20" /></div>
              <p class="kpi-label">Convirtieron a pago</p>
              <p class="kpi-value">{{ b.trialFunnel.converted | number }}</p>
              <p class="kpi-sub">usaron trial y hoy pagan</p>
            </div>
            <div class="kpi ring-1 ring-slate-200">
              <div class="kpi-ico bg-slate-100 text-slate-700"><ui-icon name="trending-up" [size]="20" /></div>
              <p class="kpi-label">Conversión</p>
              <p class="kpi-value">{{ b.trialFunnel.conversionPct | number:'1.0-1' }}%</p>
              <p class="kpi-sub">trial → pago</p>
            </div>
          </div>
        </section>

        <!-- ══ Costos & Margen (EBITDA) ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Costos &amp; margen</h2>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="kpi">
              <div class="kpi-ico bg-rose-50 text-rose-600"><ui-icon name="wallet" [size]="20" /></div>
              <p class="kpi-label">Gastos de la empresa (mes)</p>
              <p class="kpi-value">{{ b.opexMonthlyUsd + b.opexOneTimeUsd | currency:'USD':'symbol':'1.0-0' }}</p>
              <p class="kpi-sub">
                fijos {{ b.opexMonthlyUsd | currency:'USD':'symbol':'1.0-0' }}
                @if (b.opexOneTimeUsd > 0) { · pagos únicos {{ b.opexOneTimeUsd | currency:'USD':'symbol':'1.0-0' }} }
              </p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-green-50 text-green-600"><ui-icon name="message-circle" [size]="20" /></div>
              <p class="kpi-label">Costo WhatsApp (mes)</p>
              <p class="kpi-value">{{ b.whatsappCostUsd | currency:'USD':'symbol':'1.2-2' }}</p>
              <p class="kpi-sub">facturación Meta</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-violet-50 text-violet-600"><ui-icon name="credit-card" [size]="20" /></div>
              <p class="kpi-label">Fees de Stripe (mes)</p>
              <p class="kpi-value">{{ b.stripeFeesUsd | currency:'USD':'symbol':'1.2-2' }}</p>
              <p class="kpi-sub">comisiones de procesamiento</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-fuchsia-50 text-fuchsia-600"><ui-icon name="sparkles" [size]="20" /></div>
              <p class="kpi-label">Costo de IA (mes)</p>
              <p class="kpi-value">{{ b.aiCostUsd | currency:'USD':'symbol':'1.2-2' }}</p>
              <p class="kpi-sub">fal.ai + LLM + Whisper · {{ b.aiCredits | number }} créditos históricos</p>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="kpi">
              <div class="kpi-ico bg-emerald-50 text-emerald-600"><ui-icon name="trending-up" [size]="20" /></div>
              <p class="kpi-label">Margen de contribución (mes)</p>
              <div class="flex items-baseline gap-2">
                <p class="kpi-value" [class.text-emerald-600]="b.contributionMarginUsd >= 0" [class.text-red-600]="b.contributionMarginUsd < 0">
                  {{ b.contributionMarginUsd | currency:'USD':'symbol':'1.0-0' }}
                </p>
                <span class="text-sm font-semibold text-slate-500">{{ b.contributionMarginPct | percent:'1.0-0' }}</span>
              </div>
              <p class="kpi-sub">MRR − WhatsApp − Stripe − IA</p>
            </div>
            <div class="kpi ring-1 ring-slate-200">
              <div class="kpi-ico bg-slate-100 text-slate-700"><ui-icon name="banknote" [size]="20" /></div>
              <p class="kpi-label">Ganancia neta del mes (profit)</p>
              <div class="flex items-baseline gap-2">
                <p class="kpi-value" [class.text-emerald-600]="b.ebitdaUsd >= 0" [class.text-red-600]="b.ebitdaUsd < 0">
                  {{ b.ebitdaUsd | currency:'USD':'symbol':'1.0-0' }}
                </p>
                <span class="text-sm font-semibold text-slate-500">{{ b.ebitdaPct | percent:'1.0-0' }}</span>
              </div>
              <p class="kpi-sub">lo que queda: MRR − gastos de la empresa − WhatsApp − Stripe − IA</p>
            </div>
            <div class="kpi">
              <div class="kpi-ico bg-teal-50 text-teal-600"><ui-icon name="piggy-bank" [size]="20" /></div>
              <p class="kpi-label">Ganancia por catálogo pago</p>
              <p class="kpi-value" [class.text-emerald-600]="b.profitPerAccountUsd >= 0" [class.text-red-600]="b.profitPerAccountUsd < 0">
                {{ b.profitPerAccountUsd | currency:'USD':'symbol':'1.2-2' }}
              </p>
              <p class="kpi-sub">profit ÷ {{ b.payingCount }} · el ARPA ({{ b.arpaUsd | currency:'USD':'symbol':'1.2-2' }}) es antes de gastos</p>
            </div>
          </div>
          <p class="text-xs text-slate-400">
            ⓘ Ganancia neta (≈ EBITDA) en run-rate mensual (sobre el MRR). El costo de IA es aproximado por feature
            (fal.ai imágenes, LLM de texto, Whisper audio). El GMV solo suma catálogos en USD.
          </p>
        </section>

        <!-- ══ Cuentas demo ══ -->
        <section class="flex flex-col gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Cuentas demo (no cuentan en las métricas)</h2>
          <div class="kpi">
            @if (b.demoTenants.length === 0) {
              <p class="text-sm text-slate-500">
                Ninguna marcada. Para marcar una: Catálogos → abre el catálogo → "Marcar como demo".
              </p>
            } @else {
              <ul class="flex flex-col divide-y divide-slate-50">
                @for (t of b.demoTenants; track t.id) {
                  <li class="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <div class="min-w-0">
                      <a [routerLink]="['/tenants', t.id]" class="font-medium text-slate-700 hover:underline">{{ t.name ?? t.slug }}</a>
                      <span class="text-xs text-slate-400"> · {{ t.planId ? planLabel(t.planId) : '—' }} · {{ t.ownerEmail }}</span>
                    </div>
                    <button
                      (click)="store.unmarkDemo(t.id)"
                      [disabled]="store.isLoading()"
                      class="text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
                    >
                      Quitar demo
                    </button>
                  </li>
                }
              </ul>
              <p class="kpi-sub mt-2">Para marcar otra: Catálogos → abre el catálogo → "Marcar como demo".</p>
            }
          </div>
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

  protected pct(part: number, total: number): number {
    return total > 0 ? (part / total) * 100 : 0;
  }

  /** Hoy, ayer y promedios diarios. Hoy es el último día de la serie (incompleto). */
  protected signupStats(c: SignupConversion): {
    today: number;
    yesterday: number;
    avg7: number;
    avgPrev7: number;
    avg30: number;
    best: { day: string; signups: number };
  } {
    const s = c.series;
    const complete = s.slice(0, -1);
    const avg = (arr: { signups: number }[]) =>
      arr.length ? arr.reduce((a, d) => a + d.signups, 0) / arr.length : 0;
    const best = s.reduce(
      (m, d) => (d.signups > m.signups ? { day: d.day, signups: d.signups } : m),
      { day: '', signups: 0 }
    );
    return {
      today: s.at(-1)?.signups ?? 0,
      yesterday: s.at(-2)?.signups ?? 0,
      avg7: avg(complete.slice(-7)),
      avgPrev7: avg(complete.slice(-14, -7)),
      avg30: avg(complete),
      best,
    };
  }

    protected maxSignups(c: SignupConversion): number {
    return c.series.reduce((m, d) => Math.max(m, d.signups), 0);
  }

  protected last7(c: SignupConversion): { signups: number; converted: number } {
    return c.series.slice(-7).reduce(
      (acc, d) => ({ signups: acc.signups + d.signups, converted: acc.converted + d.converted }),
      { signups: 0, converted: 0 }
    );
  }

  protected dayLabel(day: string | undefined): string {
    if (!day) return '';
    const [y, mo, d] = day.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  protected sourceLabel(source: TopPayer['source']): string {
    return { stripe: 'Stripe', manual: 'Manual', app_store: 'App Store', play_store: 'Play Store' }[source] ?? source;
  }

  protected sourceClass(source: TopPayer['source']): string {
    const base = 'text-xs font-semibold px-1.5 py-0.5 rounded-md ';
    if (source === 'stripe') return base + 'bg-violet-50 text-violet-700';
    if (source === 'manual') return base + 'bg-amber-50 text-amber-700';
    return base + 'bg-sky-50 text-sky-700';
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

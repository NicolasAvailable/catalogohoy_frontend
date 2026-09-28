import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@ui';
import { cycleLabel, tierLabel } from '../../shared/plan-cycle.model';
import { countryLabel } from '../../shared/country.util';
import {
  AssignPlanDialog,
  AssignPlanPayload,
} from '../components/assign-plan-dialog/assign-plan-dialog';
import {
  StripeBilling,
  Tenant,
  TenantDetail as TenantDetailModel,
  TenantMonthlyOrders,
} from '../tenants.model';
import { TenantsService } from '../tenants.service';

/** Fila unificada del historial de pagos (manuales + facturas de Stripe). */
interface PaymentRow {
  key: string;
  source: 'manual' | 'stripe';
  title: string;
  subtitle: string;
  status: string;
  /** ok = verde · muted = gris · bad = rojo */
  tone: 'ok' | 'muted' | 'bad';
  amount: number | null;
  currency: string;
  url: string | null;
  /** ISO — clave de orden (desc). */
  date: string;
}

const MONTH_LABELS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  tiktok: 'TikTok',
};

/** Altura máxima (rem) de la barra más alta del gráfico de órdenes por mes. */
const MAX_BAR_REM = 8;

/**
 * Detalle completo de un catálogo para el panel interno: KPIs de órdenes
 * (totales, últimos 30 días y por mes), checklist de configuración inicial
 * (mismos criterios que el card "primeros pasos" del Inicio), historial de
 * pagos/renovaciones, equipo, canales conectados y actividad. Todo sale de un
 * solo RPC (`get_tenant_detail_admin`).
 */
@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [
    IconComponent,
    RouterLink,
    DatePipe,
    DecimalPipe,
    CurrencyPipe,
    AssignPlanDialog,
  ],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0 overflow-y-auto pb-8">
      <header class="flex items-center gap-3 shrink-0">
        <a
          routerLink="/tenants"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white border border-grey-50 hover:bg-grey-50 transition-colors"
          aria-label="Volver a catálogos"
        >
          <ui-icon name="arrow-left" size="16" styleClass="text-grey-500" />
        </a>
        <div class="flex flex-col">
          <h1 class="text-2xl font-bold text-grey-700">Detalle del catálogo</h1>
          <p class="text-sm text-grey-400">
            Todo lo que sabemos de este catálogo, en un solo lugar.
          </p>
        </div>
      </header>

      @if (error()) {
        <div
          class="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 border border-red-100"
        >
          <ui-icon name="circle-alert" size="16" styleClass="text-red-500" />
          <span class="text-sm text-red-600">{{ error() }}</span>
          <button
            type="button"
            (click)="load()"
            class="ml-auto text-sm font-semibold text-red-600 hover:underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      }

      @if (isLoading()) {
        <div class="flex flex-col items-center gap-2 py-16">
          <ui-icon
            name="loader-circle"
            size="28"
            styleClass="text-grey-300 animate-spin"
          />
          <p class="text-sm text-grey-400">Cargando detalle...</p>
        </div>
      } @else if (detail(); as d) {
        <!-- ============ Cabecera del catálogo ============ -->
        <section
          class="bg-white rounded-xl border border-grey-50 p-5 flex flex-col gap-4"
        >
          <div class="flex flex-wrap items-start gap-4">
            @if (d.tenant.logo && !logoBroken()) {
              <img
                [src]="d.tenant.logo"
                [alt]="d.tenant.name ?? ''"
                referrerpolicy="no-referrer"
                (error)="logoBroken.set(true)"
                class="w-16 h-16 rounded-xl object-cover shrink-0 border border-grey-50"
              />
            } @else {
              <div
                class="w-16 h-16 rounded-xl bg-primary-500 flex items-center justify-center shrink-0 text-white text-xl font-bold uppercase"
              >
                {{ initial(d) }}
              </div>
            }

            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <strong class="text-xl font-bold text-grey-700">
                  {{ d.tenant.name ?? 'Sin nombre' }}
                </strong>
                <span class="text-xs text-grey-400">#{{ d.tenant.id }}</span>
                @if (planBadge(d); as badge) {
                  <span
                    class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                    [class]="badge.classes"
                  >
                    {{ badge.label }}
                  </span>
                }
                @if (d.plan.stripeSubscriptionStatus) {
                  <span
                    class="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-xs font-semibold"
                  >
                    Stripe: {{ d.plan.stripeSubscriptionStatus }}
                  </span>
                }
                @if (ownersBanned()) {
                  <span
                    class="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-semibold"
                  >
                    <ui-icon name="user-x" size="10" styleClass="text-red-500" />
                    Dueño baneado
                  </span>
                }
              </div>

              <div class="flex items-center gap-3 flex-wrap text-sm text-grey-500">
                @if (d.tenant.slug) {
                  <a
                    [href]="storefrontUrl(d)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-primary-600 hover:underline"
                  >
                    <ui-icon name="external-link" size="12" styleClass="text-primary-500" />
                    {{ d.tenant.slug }}.catalogohoy.com
                  </a>
                }
                @if (d.tenant.customDomain) {
                  <span class="inline-flex items-center gap-1">
                    <ui-icon name="globe" size="12" styleClass="text-grey-400" />
                    {{ d.tenant.customDomain }}
                  </span>
                }
                <span>{{ countryLabel(d.tenant.countryCode) }}</span>
              </div>

              <div class="flex items-center gap-3 flex-wrap text-xs text-grey-400">
                <span>
                  Creado el {{ d.tenant.createdAt | date: 'dd/MM/yyyy' }}
                  ({{ age(d.tenant.createdAt) }})
                </span>
                <span
                  class="inline-flex items-center gap-1"
                  [class.text-emerald-600]="d.tenant.isVisible"
                  [class.text-red-500]="!d.tenant.isVisible"
                >
                  <ui-icon
                    [name]="d.tenant.isVisible ? 'eye' : 'eye-off'"
                    size="12"
                  />
                  {{ d.tenant.isVisible ? 'Visible' : 'Oculto' }}
                </span>
                <span
                  class="inline-flex items-center gap-1"
                  [class.text-emerald-600]="d.tenant.isAcceptingOrders"
                  [class.text-red-500]="!d.tenant.isAcceptingOrders"
                >
                  <ui-icon
                    [name]="d.tenant.isAcceptingOrders ? 'shopping-bag' : 'ban'"
                    size="12"
                  />
                  {{
                    d.tenant.isAcceptingOrders
                      ? 'Acepta pedidos'
                      : 'No acepta pedidos'
                  }}
                </span>
                <span>Moneda: {{ d.tenant.currency }}</span>
                @if (d.tenant.extraCatalogs > 0) {
                  <span>+{{ d.tenant.extraCatalogs }} catálogos extra</span>
                }
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="openAssignDialog(d)"
                [disabled]="isMutating()"
                class="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors cursor-pointer text-xs font-semibold disabled:opacity-50"
              >
                <ui-icon name="crown" size="12" styleClass="text-primary-500" />
                {{ d.plan.tier === 'gratis' ? 'Asignar plan' : 'Editar plan' }}
              </button>
              <button
                type="button"
                (click)="onToggleBan(d)"
                [disabled]="isBanning()"
                class="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                [class.text-red-600]="!ownersBanned()"
                [class.hover:bg-red-50]="!ownersBanned()"
                [class.text-emerald-600]="ownersBanned()"
                [class.hover:bg-emerald-50]="ownersBanned()"
              >
                @if (isBanning()) {
                  <ui-icon name="loader-circle" size="12" styleClass="animate-spin" />
                } @else {
                  <ui-icon
                    [name]="ownersBanned() ? 'user-check' : 'user-x'"
                    size="12"
                  />
                }
                {{ ownersBanned() ? 'Desbanear dueño' : 'Banear dueño' }}
              </button>
            </div>
          </div>

          @if (d.plan.tier !== 'gratis') {
            <div
              class="flex items-center gap-4 flex-wrap text-xs text-grey-500 pt-3 border-t border-grey-50"
            >
              <span>
                Plan desde:
                <strong class="text-grey-700">
                  {{ d.plan.startedAt | date: 'dd/MM/yyyy' }}
                </strong>
              </span>
              @if (d.plan.expiresAt) {
                <span>
                  Vence:
                  <strong
                    [class.text-red-600]="d.plan.expired"
                    [class.text-grey-700]="!d.plan.expired"
                  >
                    {{ d.plan.expiresAt | date: 'dd/MM/yyyy' }}
                  </strong>
                </span>
              }
              @if (d.plan.cycle) {
                <span>Ciclo: {{ cycleLabel(d.plan.cycle) }}</span>
              }
              @if (d.plan.previousPlanId) {
                <span>Plan anterior: {{ tierLabel(d.plan.previousPlanId) }}</span>
              }
            </div>
          }
        </section>

        <!-- ============ KPIs ============ -->
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="flex flex-col gap-1 p-4 rounded-xl bg-white border border-grey-50">
            <span class="text-[10px] uppercase font-semibold text-grey-400">
              Órdenes totales
            </span>
            <strong class="text-2xl font-bold text-grey-700">
              {{ d.orders.total | number }}
            </strong>
            <span class="text-xs text-grey-400">
              {{ d.orders.completed }} completadas · {{ d.orders.pending }} pendientes
            </span>
          </div>

          <div class="flex flex-col gap-1 p-4 rounded-xl bg-white border border-grey-50">
            <span class="text-[10px] uppercase font-semibold text-grey-400">
              Órdenes últimos 30 días
            </span>
            <strong class="text-2xl font-bold text-grey-700">
              {{ d.orders.last30d | number }}
            </strong>
            <span
              class="text-xs inline-flex items-center gap-1"
              [class.text-emerald-600]="d.orders.last30d >= d.orders.prev30d"
              [class.text-red-500]="d.orders.last30d < d.orders.prev30d"
            >
              <ui-icon
                [name]="
                  d.orders.last30d >= d.orders.prev30d
                    ? 'trending-up'
                    : 'trending-down'
                "
                size="12"
              />
              {{ d.orders.prev30d }} en los 30 previos
            </span>
          </div>

          <div class="flex flex-col gap-1 p-4 rounded-xl bg-white border border-grey-50">
            <span class="text-[10px] uppercase font-semibold text-grey-400">
              Ventas en órdenes
            </span>
            <strong class="text-2xl font-bold text-grey-700">
              {{ d.orders.revenueTotal | currency: d.tenant.currency : 'symbol' : '1.0-2' }}
            </strong>
            <span class="text-xs text-grey-400">
              {{ d.orders.revenueCompleted | currency: d.tenant.currency : 'symbol' : '1.0-2' }}
              en completadas
            </span>
          </div>

          <div class="flex flex-col gap-1 p-4 rounded-xl bg-primary-50 border border-primary-100">
            <span class="text-[10px] uppercase font-semibold text-grey-400">
              Nos ha pagado
            </span>
            <strong class="text-2xl font-bold text-grey-700">
              {{ totalPaid(d) | currency: 'USD' : 'symbol' : '1.0-2' }}
            </strong>
            <span class="text-xs text-grey-500">
              {{ paymentsCount(d) }}
              {{ paymentsCount(d) === 1 ? 'pago' : 'pagos' }}
              @if (stripeInvoiceCount() > 0) {
                ({{ stripeInvoiceCount() }} por Stripe)
              }
              · {{ renewals(d) }}
              {{ renewals(d) === 1 ? 'renovación' : 'renovaciones' }}
            </span>
          </div>

          <div class="flex flex-col gap-1 p-4 rounded-xl bg-white border border-grey-50">
            <span class="text-[10px] uppercase font-semibold text-grey-400">
              Productos
            </span>
            <strong class="text-2xl font-bold text-grey-700">
              {{ d.counts.products | number }}
            </strong>
            <span class="text-xs text-grey-400">
              {{ d.counts.productsVisible }} visibles ·
              {{ d.counts.categories }} categorías
            </span>
          </div>

          <div class="flex flex-col gap-1 p-4 rounded-xl bg-white border border-grey-50">
            <span class="text-[10px] uppercase font-semibold text-grey-400">
              Clientes (CRM)
            </span>
            <strong class="text-2xl font-bold text-grey-700">
              {{ d.counts.customers | number }}
            </strong>
            <span class="text-xs text-grey-400">registrados en su CRM</span>
          </div>

          <div class="flex flex-col gap-1 p-4 rounded-xl bg-white border border-grey-50">
            <span class="text-[10px] uppercase font-semibold text-grey-400">
              Chats
            </span>
            <strong class="text-2xl font-bold text-grey-700">
              {{ d.counts.chats | number }}
            </strong>
            <span class="text-xs text-grey-400">{{ chatsBreakdown(d) }}</span>
          </div>

          <div class="flex flex-col gap-1 p-4 rounded-xl bg-white border border-grey-50">
            <span class="text-[10px] uppercase font-semibold text-grey-400">
              Miembros
            </span>
            <strong class="text-2xl font-bold text-grey-700">
              {{ d.counts.teamMembers | number }}
            </strong>
            <span class="text-xs text-grey-400">con acceso al panel</span>
          </div>
        </section>

        <div class="grid lg:grid-cols-2 gap-6 items-start">
          <!-- ============ Configuración inicial ============ -->
          <section class="bg-white rounded-xl border border-grey-50 p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-bold text-grey-700">
                Configuración inicial
              </h2>
              @if (setupComplete(d)) {
                <span
                  class="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-xs font-semibold"
                >
                  <ui-icon name="check-circle" size="10" styleClass="text-emerald-500" />
                  Completada
                </span>
              } @else {
                <span class="text-xs text-grey-400">
                  {{ setupDone(d) }} de {{ setupTotal }} pasos
                </span>
              }
            </div>

            <div class="h-1.5 rounded-full bg-grey-50 overflow-hidden">
              <div
                class="h-full rounded-full bg-emerald-400 transition-all"
                [style.width.%]="(setupDone(d) / setupTotal) * 100"
              ></div>
            </div>

            <ul class="flex flex-col gap-2">
              @for (step of checklistSteps(d); track step.label) {
                <li class="flex items-center gap-2 text-sm">
                  <ui-icon
                    [name]="step.done ? 'check-circle' : 'circle'"
                    size="16"
                    [styleClass]="step.done ? 'text-emerald-500' : 'text-grey-200'"
                  />
                  <span
                    [class.text-grey-700]="step.done"
                    [class.text-grey-400]="!step.done"
                  >
                    {{ step.label }}
                  </span>
                  @if (step.badge) {
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded bg-grey-50 text-grey-400 font-semibold uppercase"
                    >
                      {{ step.badge }}
                    </span>
                  }
                </li>
              }
            </ul>
          </section>

          <!-- ============ Órdenes por mes ============ -->
          <section class="bg-white rounded-xl border border-grey-50 p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-bold text-grey-700">
                Órdenes por mes (últimos 12)
              </h2>
              <span class="text-xs text-grey-400">
                Promedio: {{ monthlyAverage(d) | number: '1.0-1' }}/mes
              </span>
            </div>

            @if (hasMonthlyOrders(d)) {
              <div class="flex items-end gap-1.5">
                @for (m of d.ordersMonthly; track m.month) {
                  <div
                    class="flex-1 flex flex-col items-center gap-1 min-w-0"
                    [title]="monthTitle(m)"
                  >
                    <span class="text-[10px] text-grey-500 font-semibold h-4">
                      {{ m.count > 0 ? m.count : '' }}
                    </span>
                    <div
                      class="w-full rounded-t-md transition-colors"
                      [class.bg-primary-300]="m.count > 0"
                      [class.hover:bg-primary-400]="m.count > 0"
                      [class.bg-grey-50]="m.count === 0"
                      [style.height.rem]="barRem(m, d)"
                    ></div>
                    <span class="text-[10px] text-grey-400">
                      {{ monthLabel(m.month) }}
                    </span>
                  </div>
                }
              </div>
            } @else {
              <div
                class="flex flex-col items-center gap-2 py-8 rounded-lg border border-dashed border-grey-100"
              >
                <ui-icon name="inbox" size="24" styleClass="text-grey-300" />
                <span class="text-xs text-grey-400">
                  Sin órdenes en los últimos 12 meses
                </span>
              </div>
            }

            <div class="flex items-center gap-4 flex-wrap text-xs text-grey-400 pt-2 border-t border-grey-50">
              @if (d.orders.firstAt) {
                <span>
                  Primera orden: {{ d.orders.firstAt | date: 'dd/MM/yyyy' }}
                </span>
              }
              @if (d.orders.lastAt) {
                <span>
                  Última orden: {{ d.orders.lastAt | date: 'dd/MM/yyyy' }}
                  ({{ age(d.orders.lastAt) }})
                </span>
              }
            </div>
          </section>

          <!-- ============ Historial de pagos ============ -->
          <section class="bg-white rounded-xl border border-grey-50 p-5 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <h2 class="text-sm font-bold text-grey-700">Historial de pagos</h2>
              <div class="flex items-center gap-3">
                @if (stripe()?.customerId; as customerId) {
                  <a
                    [href]="'https://dashboard.stripe.com/customers/' + customerId"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    <ui-icon name="external-link" size="10" styleClass="text-indigo-500" />
                    Ver en Stripe
                  </a>
                }
                <span class="text-xs text-grey-400">Más recientes primero</span>
              </div>
            </div>

            @if (isLoadingStripe()) {
              <div class="flex items-center gap-2 text-xs text-grey-400">
                <ui-icon
                  name="loader-circle"
                  size="12"
                  styleClass="text-grey-300 animate-spin"
                />
                Cargando historial de Stripe...
              </div>
            } @else if (stripeError()) {
              <div
                class="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700"
              >
                <ui-icon name="circle-alert" size="12" styleClass="text-amber-500" />
                No se pudo cargar el historial de Stripe:
                {{ stripeError() }}
              </div>
            }

            <!-- Suscripciones de Stripe (estado real, incluye canceladas) -->
            @if (stripe(); as sb) {
              @if (sb.subscriptions.length > 0) {
                <div class="flex flex-col gap-2">
                  @for (sub of sb.subscriptions; track sub.id) {
                    <div
                      class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-indigo-50/50 border border-indigo-100"
                    >
                      <div class="flex items-center gap-2 flex-wrap min-w-0">
                        <span
                          class="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-semibold uppercase"
                        >
                          Suscripción Stripe
                        </span>
                        <span class="text-sm text-grey-700 font-semibold">
                          {{ sub.planNickname ?? 'Plan' }}
                        </span>
                        @if (sub.interval) {
                          <span class="text-xs text-grey-500">
                            {{ sub.interval === 'year' ? 'Anual' : 'Mensual' }}
                          </span>
                        }
                        <span
                          class="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                          [class.bg-emerald-50]="sub.status === 'active' || sub.status === 'trialing'"
                          [class.text-emerald-600]="sub.status === 'active' || sub.status === 'trialing'"
                          [class.bg-amber-50]="sub.status === 'past_due' || sub.status === 'unpaid'"
                          [class.text-amber-600]="sub.status === 'past_due' || sub.status === 'unpaid'"
                          [class.bg-red-50]="sub.status === 'canceled' || sub.status === 'incomplete_expired'"
                          [class.text-red-600]="sub.status === 'canceled' || sub.status === 'incomplete_expired'"
                        >
                          {{ sub.status }}
                        </span>
                        @if (sub.cancelAtPeriodEnd) {
                          <span class="text-[10px] text-amber-600 font-semibold">
                            cancela al final del período
                          </span>
                        }
                      </div>
                      <span class="text-xs text-grey-500 shrink-0">
                        @if (sub.canceledAt) {
                          Cancelada el {{ sub.canceledAt | date: 'dd/MM/yyyy' }}
                        } @else if (sub.currentPeriodEnd) {
                          Renueva el {{ sub.currentPeriodEnd | date: 'dd/MM/yyyy' }}
                        }
                      </span>
                    </div>
                  }
                </div>
              }
            }

            @if (paymentRows(d).length === 0) {
              <div
                class="flex flex-col items-center gap-2 py-8 rounded-lg border border-dashed border-grey-100"
              >
                <ui-icon name="inbox" size="24" styleClass="text-grey-300" />
                <span class="text-xs text-grey-400">
                  Sin pagos registrados (ni manuales ni por Stripe)
                </span>
              </div>
            } @else {
              <div class="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                @for (row of paymentRows(d); track row.key) {
                  <div
                    class="flex items-center justify-between gap-3 p-3 rounded-lg border border-grey-50 bg-grey-25"
                  >
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span
                          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                          [class.bg-indigo-50]="row.source === 'stripe'"
                          [class.text-indigo-600]="row.source === 'stripe'"
                          [class.bg-grey-50]="row.source === 'manual'"
                          [class.text-grey-500]="row.source === 'manual'"
                        >
                          {{ row.source === 'stripe' ? 'Stripe' : 'Manual' }}
                        </span>
                        <strong class="text-sm font-semibold text-grey-700">
                          {{ row.title }}
                        </strong>
                        <span
                          class="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                          [class.bg-emerald-50]="row.tone === 'ok'"
                          [class.text-emerald-600]="row.tone === 'ok'"
                          [class.bg-grey-50]="row.tone === 'muted'"
                          [class.text-grey-500]="row.tone === 'muted'"
                          [class.bg-red-50]="row.tone === 'bad'"
                          [class.text-red-600]="row.tone === 'bad'"
                        >
                          {{ row.status }}
                        </span>
                        @if (row.url) {
                          <a
                            [href]="row.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline"
                          >
                            <ui-icon name="external-link" size="10" styleClass="text-indigo-500" />
                            factura
                          </a>
                        }
                      </div>
                      <span class="text-xs text-grey-400">{{ row.subtitle }}</span>
                    </div>
                    @if (row.amount !== null) {
                      <strong class="text-sm font-bold text-grey-700 shrink-0">
                        {{ row.amount | currency: row.currency : 'symbol' : '1.0-2' }}
                      </strong>
                    }
                  </div>
                }
              </div>
            }
          </section>

          <!-- ============ Equipo + canales + actividad ============ -->
          <div class="flex flex-col gap-6">
            <section class="bg-white rounded-xl border border-grey-50 p-5 flex flex-col gap-3">
              <h2 class="text-sm font-bold text-grey-700">Equipo</h2>
              <div class="flex flex-col gap-2">
                @for (member of d.members; track member.email) {
                  <div class="flex items-center gap-3">
                    @if (member.avatarUrl) {
                      <img
                        [src]="member.avatarUrl"
                        [alt]="member.name ?? ''"
                        referrerpolicy="no-referrer"
                        class="w-8 h-8 rounded-full object-cover border border-grey-50 shrink-0"
                      />
                    } @else {
                      <div
                        class="w-8 h-8 rounded-full bg-grey-100 flex items-center justify-center shrink-0"
                      >
                        <ui-icon name="user" size="14" styleClass="text-grey-400" />
                      </div>
                    }
                    <div class="flex flex-col min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-sm text-grey-700 truncate">
                          {{ member.name ?? member.email ?? 'Sin nombre' }}
                        </span>
                        @if (member.role) {
                          <span
                            class="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                            [class.bg-primary-50]="member.role === 'owner'"
                            [class.text-primary-600]="member.role === 'owner'"
                            [class.bg-grey-50]="member.role !== 'owner'"
                            [class.text-grey-500]="member.role !== 'owner'"
                          >
                            {{ member.role === 'owner' ? 'Dueño' : member.role }}
                          </span>
                        }
                      </div>
                      <span class="text-xs text-grey-400 truncate">
                        {{ member.email }}
                        @if (member.phone) {
                          · {{ member.phone }}
                        }
                      </span>
                    </div>
                    @if (member.phone) {
                      <a
                        [href]="whatsappUrl(member.phone)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center justify-center w-8 h-8 rounded-md bg-emerald-50 hover:bg-emerald-100 transition-colors shrink-0"
                        title="Escribir por WhatsApp"
                      >
                        <ui-icon
                          name="message-circle"
                          size="14"
                          styleClass="text-emerald-600"
                        />
                      </a>
                    }
                  </div>
                } @empty {
                  <span class="text-xs text-grey-400">Sin miembros.</span>
                }
              </div>
            </section>

            <section class="bg-white rounded-xl border border-grey-50 p-5 flex flex-col gap-3">
              <h2 class="text-sm font-bold text-grey-700">Canales conectados</h2>
              @if (d.channels.length === 0) {
                <span class="text-xs text-grey-400">
                  Sin canales conectados al CRM.
                </span>
              } @else {
                <div class="flex flex-col gap-2">
                  @for (channel of d.channels; track $index) {
                    <div class="flex items-center gap-2 text-sm text-grey-600">
                      <span
                        class="inline-flex items-center px-2 py-1 rounded bg-grey-50 text-grey-600 text-xs font-semibold"
                      >
                        {{ channelLabel(channel.channel) }}
                      </span>
                      <span class="truncate">
                        {{ channel.displayName ?? channel.identity ?? '—' }}
                        @if (channel.displayName && channel.identity) {
                          <span class="text-grey-400">
                            · {{ channel.identity }}
                          </span>
                        }
                      </span>
                      @if (channel.connectedAt) {
                        <span class="text-xs text-grey-400 ml-auto shrink-0">
                          {{ channel.connectedAt | date: 'dd/MM/yyyy' }}
                        </span>
                      }
                    </div>
                  }
                </div>
              }
            </section>

            <section class="bg-white rounded-xl border border-grey-50 p-5 flex flex-col gap-3">
              <h2 class="text-sm font-bold text-grey-700">Actividad reciente</h2>
              <div class="flex flex-col gap-2 text-sm text-grey-600">
                <div class="flex items-center gap-2">
                  <ui-icon name="package" size="14" styleClass="text-grey-400" />
                  <span>
                    Último producto:
                    @if (d.activity.lastProductAt) {
                      {{ d.activity.lastProductAt | date: 'dd/MM/yyyy' }}
                      <span class="text-grey-400">
                        ({{ age(d.activity.lastProductAt) }})
                      </span>
                    } @else {
                      <span class="text-grey-400">nunca</span>
                    }
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <ui-icon name="shopping-bag" size="14" styleClass="text-grey-400" />
                  <span>
                    Última orden:
                    @if (d.orders.lastAt) {
                      {{ d.orders.lastAt | date: 'dd/MM/yyyy' }}
                      <span class="text-grey-400">
                        ({{ age(d.orders.lastAt) }})
                      </span>
                    } @else {
                      <span class="text-grey-400">nunca</span>
                    }
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <ui-icon name="message-circle" size="14" styleClass="text-grey-400" />
                  <span>
                    Último chat:
                    @if (d.activity.lastChatAt) {
                      {{ d.activity.lastChatAt | date: 'dd/MM/yyyy' }}
                      <span class="text-grey-400">
                        ({{ age(d.activity.lastChatAt) }})
                      </span>
                    } @else {
                      <span class="text-grey-400">nunca</span>
                    }
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      }
    </div>

    <app-assign-plan-dialog
      (assign)="onAssign($event)"
      (remove)="onRemove($event)"
    />
  `,
})
export class TenantDetail implements OnInit {
  /** Route param (`/tenants/:id`) via component input binding. */
  public readonly id = input.required<string>();

  private readonly tenantsService = inject(TenantsService);

  protected readonly detail = signal<TenantDetailModel | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isMutating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly logoBroken = signal(false);
  protected readonly ownersBanned = signal(false);
  protected readonly isBanning = signal(false);

  /** Historial real de Stripe — se carga lazy solo si el tenant tiene
   *  stripe_customer_id (no bloquea el render del resto del detalle). */
  protected readonly stripe = signal<StripeBilling | null>(null);
  protected readonly isLoadingStripe = signal(false);
  protected readonly stripeError = signal<string | null>(null);

  private readonly dialog = viewChild.required(AssignPlanDialog);

  private readonly tenantId = computed(() => Number(this.id()));

  /** Pasos que cuentan para "configuración completada" (los mismos 3 no-locked
   *  del checklist del Inicio; los avisos WhatsApp son solo de planes pagos). */
  protected readonly setupTotal = 3;

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    const id = this.tenantId();
    if (!Number.isFinite(id)) {
      this.error.set('Id de catálogo inválido.');
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    const result = await this.tenantsService.getDetail(id);
    this.isLoading.set(false);
    result.fold(
      (err) => this.error.set(err.message),
      (detail) => {
        this.detail.set(detail);
        if (detail.plan.stripeCustomerId) {
          void this.loadStripe(id);
        }
      }
    );
    const banned = await this.tenantsService.isOwnersBanned(id);
    banned.mapRight((b) => this.ownersBanned.set(b));
  }

  private async loadStripe(tenantId: number): Promise<void> {
    this.isLoadingStripe.set(true);
    this.stripeError.set(null);
    const result = await this.tenantsService.getStripeHistory(tenantId);
    this.isLoadingStripe.set(false);
    result.fold(
      (err) => this.stripeError.set(err.message),
      (billing) => this.stripe.set(billing)
    );
  }

  // -------------------------------------------------------------------------
  // Acciones (plan + ban) — reusa el dialog y el service del listado.
  // -------------------------------------------------------------------------

  protected openAssignDialog(d: TenantDetailModel): void {
    this.dialog().show(this.toTenant(d));
  }

  protected async onAssign(payload: AssignPlanPayload): Promise<void> {
    this.isMutating.set(true);
    const result = await this.tenantsService.assignPlan(
      payload.tenantId,
      payload.tier,
      payload.cycle,
      payload.amountUsd,
      payload.consumeCreditUsd
    );
    this.isMutating.set(false);
    result.fold(
      (err) => this.error.set(err.message),
      () => void this.load()
    );
  }

  protected async onRemove(tenantId: number): Promise<void> {
    this.isMutating.set(true);
    const result = await this.tenantsService.removePlan(tenantId);
    this.isMutating.set(false);
    result.fold(
      (err) => this.error.set(err.message),
      () => void this.load()
    );
  }

  protected async onToggleBan(d: TenantDetailModel): Promise<void> {
    const willBan = !this.ownersBanned();
    const verb = willBan ? 'BANEAR' : 'DESBANEAR';
    const ok = window.confirm(
      `¿Seguro que querés ${verb} al dueño de "${d.tenant.name ?? d.tenant.slug ?? 'este catálogo'}"?\n\n` +
        (willBan
          ? 'No va a poder iniciar sesión en ningún subdominio de CatalogoHoy hasta que lo desbanees.'
          : 'Va a recuperar acceso para iniciar sesión normalmente.')
    );
    if (!ok) return;
    this.isBanning.set(true);
    const res = await this.tenantsService.setOwnersBanned(d.tenant.id, willBan);
    this.isBanning.set(false);
    res.fold(
      (err) => window.alert(`No se pudo ${verb.toLowerCase()}: ${err.message}`),
      () => this.ownersBanned.set(willBan)
    );
  }

  /** El dialog de asignar plan espera la forma `Tenant` del listado. */
  private toTenant(d: TenantDetailModel): Tenant {
    const owner = d.members.find((m) => m.role === 'owner') ?? d.members[0];
    return {
      id: d.tenant.id,
      name: d.tenant.name,
      slug: d.tenant.slug,
      countryCode: d.tenant.countryCode,
      logo: d.tenant.logo,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      createdAt: d.tenant.createdAt,
      plan: {
        tier: d.plan.tier,
        cycle: d.plan.cycle,
        startedAt: d.plan.startedAt ?? d.tenant.createdAt,
        expiresAt: d.plan.expiresAt,
        expired: d.plan.expired,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Presentación
  // -------------------------------------------------------------------------

  protected initial(d: TenantDetailModel): string {
    const source = d.tenant.name ?? d.tenant.slug ?? '?';
    return source.trim().charAt(0).toUpperCase() || '?';
  }

  protected storefrontUrl(d: TenantDetailModel): string {
    return `https://${d.tenant.slug}.catalogohoy.com`;
  }

  protected planBadge(
    d: TenantDetailModel
  ): { label: string; classes: string } | null {
    if (d.plan.tier === 'gratis') {
      return { label: 'Gratis', classes: 'bg-grey-50 text-grey-500' };
    }
    return d.plan.expired
      ? {
          label: `${tierLabel(d.plan.tier)} (vencido)`,
          classes: 'bg-red-50 text-red-600',
        }
      : {
          label: tierLabel(d.plan.tier),
          classes: 'bg-emerald-50 text-emerald-600',
        };
  }

  /** "hace 3 días" / "hace 5 meses" / "hace 1 año y 2 meses" */
  protected age(dateStr: string): string {
    const days = Math.floor(
      (Date.now() - new Date(dateStr).getTime()) / 86_400_000
    );
    if (days <= 0) return 'hoy';
    if (days === 1) return 'hace 1 día';
    if (days < 30) return `hace ${days} días`;
    const months = Math.floor(days / 30);
    if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const yearsPart = `${years} ${years === 1 ? 'año' : 'años'}`;
    return rest > 0
      ? `hace ${yearsPart} y ${rest} ${rest === 1 ? 'mes' : 'meses'}`
      : `hace ${yearsPart}`;
  }

  protected checklistSteps(
    d: TenantDetailModel
  ): { label: string; done: boolean; badge: string | null }[] {
    return [
      {
        label: 'Creó su primer producto',
        done: d.checklist.hasProduct,
        badge: null,
      },
      {
        label: 'Personalizó su catálogo (logo, banner o descripción)',
        done: d.checklist.customized,
        badge: null,
      },
      {
        label: 'Agregó vendedores de WhatsApp al checkout',
        done: d.checklist.hasSellers,
        badge: null,
      },
      {
        label: 'Activó avisos de órdenes por WhatsApp',
        done: d.checklist.notifyConfigured,
        badge: 'Plan pago',
      },
    ];
  }

  protected setupDone(d: TenantDetailModel): number {
    return [
      d.checklist.hasProduct,
      d.checklist.customized,
      d.checklist.hasSellers,
    ].filter(Boolean).length;
  }

  protected setupComplete(d: TenantDetailModel): boolean {
    return this.setupDone(d) === this.setupTotal;
  }

  // -------------------------------------------------------------------------
  // Pagos combinados (manuales + Stripe)
  // -------------------------------------------------------------------------

  protected stripeInvoiceCount(): number {
    return this.stripe()?.invoices.length ?? 0;
  }

  /** USD bruto liquidado según Stripe (balance transactions). Fallback: suma
   *  de las facturas que ya están en USD (las de moneda local sin conversión
   *  conocida no se suman para no inflar el total). */
  private stripePaidTotal(): number {
    const sb = this.stripe();
    if (!sb) return 0;
    if (sb.paidTotalUsd !== null) return sb.paidTotalUsd;
    return sb.invoices.reduce(
      (sum, i) => sum + (i.currency === 'USD' ? i.amountPaid : 0),
      0
    );
  }

  protected totalPaid(d: TenantDetailModel): number {
    return d.subscriptions.totalPaidUsd + this.stripePaidTotal();
  }

  protected paymentsCount(d: TenantDetailModel): number {
    return d.subscriptions.paymentsCount + this.stripeInvoiceCount();
  }

  /** Renovaciones = veces que volvió a pagar (pagos combinados − 1). */
  protected renewals(d: TenantDetailModel): number {
    return Math.max(this.paymentsCount(d) - 1, 0);
  }

  /** Historial unificado: pagos manuales + facturas pagadas de Stripe,
   *  más recientes primero. */
  protected paymentRows(d: TenantDetailModel): PaymentRow[] {
    const manual: PaymentRow[] = d.subscriptions.history.map((entry) => ({
      key: `manual-${entry.id}`,
      source: 'manual',
      title:
        tierLabel(entry.tier) +
        (entry.cycle ? ` · ${cycleLabel(entry.cycle)}` : ''),
      subtitle:
        this.formatDate(entry.startedAt) +
        (entry.expiresAt ? ` → ${this.formatDate(entry.expiresAt)}` : '') +
        (entry.paymentMethod ? ` · ${entry.paymentMethod}` : ''),
      status: this.subscriptionStatusLabel(entry.status),
      tone:
        entry.status === 'active'
          ? 'ok'
          : entry.status === 'cancelled'
            ? 'bad'
            : 'muted',
      amount: entry.amountUsd,
      currency: 'USD',
      url: null,
      date: entry.startedAt,
    }));

    const stripeRows: PaymentRow[] = (this.stripe()?.invoices ?? []).map(
      (invoice) => ({
        key: `stripe-${invoice.id}`,
        source: 'stripe',
        title: invoice.description ?? 'Factura de suscripción',
        subtitle:
          this.formatDate(invoice.createdAt) +
          (invoice.number ? ` · ${invoice.number}` : ''),
        status: 'Pagada',
        tone: 'ok',
        amount: invoice.amountPaid,
        currency: invoice.currency,
        url: invoice.hostedInvoiceUrl,
        date: invoice.createdAt,
      })
    );

    return [...manual, ...stripeRows].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  private formatDate(iso: string): string {
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  protected hasMonthlyOrders(d: TenantDetailModel): boolean {
    return d.ordersMonthly.some((m) => m.count > 0);
  }

  protected monthlyAverage(d: TenantDetailModel): number {
    const months = d.ordersMonthly;
    if (months.length === 0) return 0;
    return months.reduce((sum, m) => sum + m.count, 0) / months.length;
  }

  protected barRem(m: TenantMonthlyOrders, d: TenantDetailModel): number {
    const max = Math.max(...d.ordersMonthly.map((x) => x.count), 1);
    if (m.count === 0) return 0.125;
    return Math.max((m.count / max) * MAX_BAR_REM, 0.375);
  }

  protected monthLabel(month: string): string {
    return MONTH_LABELS[Number(month.slice(5)) - 1] ?? month;
  }

  protected monthTitle(m: TenantMonthlyOrders): string {
    const name = MONTH_NAMES[Number(m.month.slice(5)) - 1] ?? m.month;
    const orders = `${m.count} ${m.count === 1 ? 'orden' : 'órdenes'}`;
    return `${name} ${m.month.slice(0, 4)} · ${orders} · ${m.revenue.toFixed(2)}`;
  }

  protected chatsBreakdown(d: TenantDetailModel): string {
    const parts = Object.entries(d.chatsByChannel)
      .sort(([, a], [, b]) => b - a)
      .map(([channel, count]) => `${count} ${this.channelLabel(channel)}`);
    return parts.length > 0 ? parts.join(' · ') : 'sin conversaciones';
  }

  protected channelLabel(channel: string): string {
    return CHANNEL_LABELS[channel] ?? channel;
  }

  protected whatsappUrl(phone: string): string {
    return `https://wa.me/${phone.replace(/\D+/g, '')}`;
  }

  protected subscriptionStatusLabel(
    status: 'active' | 'expired' | 'cancelled'
  ): string {
    switch (status) {
      case 'active':
        return 'Activa';
      case 'expired':
        return 'Vencida';
      case 'cancelled':
        return 'Cancelada';
    }
  }

  protected tierLabel = tierLabel;
  protected cycleLabel = cycleLabel;
  protected countryLabel = countryLabel;
}

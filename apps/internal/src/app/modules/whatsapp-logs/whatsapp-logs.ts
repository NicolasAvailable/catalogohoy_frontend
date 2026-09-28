import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import {
  categoryLabel,
  describeVariables,
  statusLabel,
  TEMPLATE_CATEGORY,
  templateLabel,
  WhatsappLog,
  WhatsappLogStatus,
  WhatsappMonthCost,
  WhatsappMonthlyRow,
} from './whatsapp-logs.model';
import { WhatsappLogsStore } from './whatsapp-logs.store';

type StatusFilter = 'all' | WhatsappLogStatus;

@Component({
  selector: 'app-whatsapp-logs',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe, DecimalPipe],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Notificaciones WhatsApp</h1>
        <p class="text-sm text-grey-400">
          Historial de notificaciones enviadas vía WhatsApp (pedidos nuevos,
          completados, avisos de plan). Muestra los últimos
          {{ store.counts().total }} envíos.
        </p>
      </header>

      <section class="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-grey-50"
          >
            <ui-icon name="message-circle" size="18" styleClass="text-grey-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Total</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().total }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50"
          >
            <ui-icon name="check-circle" size="18" styleClass="text-emerald-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Enviadas</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().sent }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50"
          >
            <ui-icon name="circle-x" size="18" styleClass="text-red-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Fallidas</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().failed }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50"
          >
            <ui-icon name="ban" size="18" styleClass="text-amber-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Omitidas</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().skipped }}
            </strong>
          </div>
        </article>
      </section>

      <!-- Costo real (Meta) + desglose mensual por plantilla -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        <article class="bg-white rounded-xl border border-grey-50 p-4">
          <div class="flex items-center gap-2 mb-1">
            <ui-icon name="dollar-sign" size="15" styleClass="text-emerald-500" />
            <h2 class="text-sm font-semibold text-grey-600">
              Costo (facturación Meta)
            </h2>
          </div>
          @if (latestMonthCost(); as m) {
            <div class="flex items-end gap-1 mt-2">
              <strong class="text-2xl font-bold text-grey-700"
                >\${{ m.cost | number: '1.2-2' }}</strong
              >
              <span class="text-xs text-grey-400 mb-1">{{
                monthLabel(m.month)
              }}</span>
            </div>
            <div class="mt-2">
              @for (c of categoryRows(m); track c.category) {
                <div class="flex items-center justify-between py-1 text-sm">
                  <span class="inline-flex items-center gap-1.5 text-grey-500">
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      [class]="
                        c.category === 'MARKETING'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      "
                    ></span>
                    {{ categoryLabel(c.category) }} ·
                    {{ c.volume | number }} msj
                  </span>
                  <span class="font-semibold text-grey-700"
                    >\${{ c.cost | number: '1.2-2' }}</span
                  >
                </div>
              }
            </div>
            @for (prev of previousMonthCosts(); track prev.month) {
              <div
                class="flex items-center justify-between mt-2 pt-2 border-t border-grey-50 text-sm"
              >
                <span class="text-grey-500">{{ monthLabel(prev.month) }}</span>
                <span class="font-semibold text-grey-700"
                  >\${{ prev.cost | number: '1.2-2' }}</span
                >
              </div>
            }
            <p class="text-[0.7rem] text-grey-400 mt-3 leading-relaxed">
              Facturación real de Meta por mensaje entregado (las plantillas de
              utilidad dentro de la ventana de 24h no se cobran).
            </p>
          } @else if (store.stats()?.metaError; as metaErr) {
            <p class="text-sm text-grey-500 mt-2">
              Meta no devolvió el costo:
              <span class="text-red-600">{{ metaErr }}</span>
            </p>
            <p class="text-[0.7rem] text-grey-400 mt-2 leading-relaxed">
              El gasto exacto siempre está en el Billing Hub de Meta (cuenta de
              pago de la WABA).
            </p>
          } @else {
            <p class="text-sm text-grey-400 mt-2">Cargando costo...</p>
          }
        </article>

        <article
          class="lg:col-span-2 bg-white rounded-xl border border-grey-50 p-4 flex flex-col"
        >
          <h2 class="text-sm font-semibold text-grey-600 mb-3">
            Envíos por plantilla
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr>
                  <th
                    class="text-left text-xs uppercase tracking-wide font-semibold text-grey-500 pb-2 pr-4"
                  >
                    Plantilla
                  </th>
                  <th
                    class="text-left text-xs uppercase tracking-wide font-semibold text-grey-500 pb-2 pr-4"
                  >
                    Categoría
                  </th>
                  @for (m of monthColumns(); track m) {
                    <th
                      class="text-right text-xs uppercase tracking-wide font-semibold text-grey-500 pb-2 pl-4"
                    >
                      {{ monthLabel(m) }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of templateRows(); track row.templateType) {
                  <tr class="border-t border-grey-50">
                    <td class="py-2 pr-4 text-grey-700">
                      {{ templateLabel(row.templateType) }}
                    </td>
                    <td class="py-2 pr-4">
                      @if (row.category) {
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                          [class]="
                            row.category === 'MARKETING'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-emerald-50 text-emerald-600'
                          "
                        >
                          {{ categoryLabel(row.category) }}
                        </span>
                      } @else {
                        <span class="text-xs text-grey-300">—</span>
                      }
                    </td>
                    @for (m of monthColumns(); track m) {
                      <td class="py-2 pl-4 text-right whitespace-nowrap">
                        @if (row.months.get(m); as cell) {
                          <span class="font-semibold text-grey-700">{{
                            cell.sent | number
                          }}</span>
                          @if (cell.failed > 0) {
                            <span class="text-[0.7rem] text-red-500 ml-1"
                              >+{{ cell.failed }} err</span
                            >
                          }
                        } @else {
                          <span class="text-grey-300">—</span>
                        }
                      </td>
                    }
                  </tr>
                }
                @if (templateRows().length) {
                  <tr class="border-t border-grey-100">
                    <td class="py-2 pr-4 font-semibold text-grey-700" colspan="2">
                      Total enviadas
                    </td>
                    @for (m of monthColumns(); track m) {
                      <td
                        class="py-2 pl-4 text-right font-bold text-grey-700 whitespace-nowrap"
                      >
                        {{ monthTotal(m) | number }}
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="text-[0.7rem] text-grey-400 mt-3 leading-relaxed">
            Solo envíos por la WABA del portfolio CatalogoHoy (el número se
            re-registró ahí el 14-08-2026; lo anterior salió por el portfolio
            viejo). Son envíos aceptados según nuestros logs; el volumen
            facturado de la card corresponde solo a los entregados, por eso
            puede ser menor.
          </p>
        </article>
      </section>

      <section
        class="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0"
      >
        <div
          class="flex items-center gap-2 px-3 py-2 bg-white border border-grey-50 rounded-md flex-1 max-w-md"
        >
          <ui-icon name="search" size="16" styleClass="text-grey-400" />
          <input
            type="text"
            placeholder="Buscar por destinatario o catálogo..."
            class="flex-1 outline-none text-sm text-grey-700 placeholder:text-grey-300 bg-transparent"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
        </div>
        <div
          class="flex items-center gap-1 bg-white p-1 rounded-md border border-grey-50"
        >
          @for (filter of statusFilters; track filter.value) {
            <button
              type="button"
              (click)="statusFilter.set(filter.value)"
              class="px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
              [class.bg-primary-500]="statusFilter() === filter.value"
              [class.text-white]="statusFilter() === filter.value"
              [class.text-grey-500]="statusFilter() !== filter.value"
              [class.hover:bg-grey-50]="statusFilter() !== filter.value"
            >
              {{ filter.label }}
            </button>
          }
        </div>
        <button
          type="button"
          (click)="store.load()"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white border border-grey-50 hover:bg-grey-50 transition-colors cursor-pointer"
          aria-label="Recargar"
        >
          <ui-icon name="refresh-cw" size="14" styleClass="text-grey-500" />
        </button>
      </section>

      @if (store.error()) {
        <div
          class="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 border border-red-100 shrink-0"
        >
          <ui-icon name="circle-alert" size="16" styleClass="text-red-500" />
          <span class="text-sm text-red-600">{{ store.error() }}</span>
        </div>
      }

      <section
        class="flex-1 min-h-0 bg-white rounded-xl border border-grey-50 overflow-hidden flex flex-col"
      >
        <div class="flex-1 min-h-0 overflow-auto">
          <table class="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Destinatario
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Catálogo
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Notificación
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Estado
                </th>
                <th
                  class="sticky top-0 z-10 text-right text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              @if (store.isLoading()) {
                <tr>
                  <td colspan="5" class="px-4 py-12 text-center">
                    <div class="flex flex-col items-center gap-2">
                      <ui-icon
                        name="loader-circle"
                        size="24"
                        styleClass="text-grey-300 animate-spin"
                      />
                      <p class="text-sm text-grey-400">Cargando notificaciones...</p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (log of filteredLogs(); track log.id) {
                  <tr
                    class="hover:bg-grey-25 transition-colors align-top cursor-pointer"
                    (click)="toggle(log)"
                  >
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex items-center gap-2 min-w-0">
                        <ui-icon
                          [name]="
                            expandedId() === log.id
                              ? 'chevron-down'
                              : 'chevron-right'
                          "
                          size="16"
                          styleClass="text-grey-400 shrink-0"
                        />
                        <ui-icon
                          name="message-circle"
                          size="16"
                          styleClass="text-emerald-500 shrink-0"
                        />
                        <span class="font-medium text-grey-700 truncate">
                          {{ log.recipient ?? '—' }}
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-col min-w-0">
                        <span class="text-grey-700 truncate">
                          {{ log.tenantName ?? '—' }}
                        </span>
                        @if (log.tenantSlug) {
                          <span class="text-xs text-grey-400 truncate">
                            {{ log.tenantSlug }}
                          </span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <span class="text-grey-700">
                        {{ templateLabel(log.templateType) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <span
                        class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                        [class.bg-emerald-50]="log.status === 'sent'"
                        [class.text-emerald-600]="log.status === 'sent'"
                        [class.bg-red-50]="log.status === 'failed'"
                        [class.text-red-600]="log.status === 'failed'"
                        [class.bg-amber-50]="log.status === 'skipped'"
                        [class.text-amber-600]="log.status === 'skipped'"
                      >
                        {{ statusLabel(log.status) }}
                      </span>
                      @if (log.error) {
                        <p
                          class="mt-1 text-xs text-grey-400 max-w-xs truncate"
                          [title]="log.error"
                        >
                          {{ log.error }}
                        </p>
                      }
                    </td>
                    <td
                      class="px-4 py-3 text-right text-grey-500 border-b border-grey-50 whitespace-nowrap"
                    >
                      {{ log.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                    </td>
                  </tr>
                  @if (expandedId() === log.id) {
                    <tr class="bg-grey-25">
                      <td colspan="5" class="px-4 py-4 border-b border-grey-50">
                        <div class="flex flex-col gap-4 pl-6">
                          <div>
                            <p
                              class="text-xs font-semibold uppercase tracking-wide text-grey-400 mb-2"
                            >
                              Datos enviados
                            </p>
                            @let fields = describeVariables(log);
                            @if (fields.length) {
                              <div
                                class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 max-w-3xl"
                              >
                                @for (f of fields; track f.label) {
                                  <div class="flex gap-2 text-sm">
                                    <span class="text-grey-400 shrink-0">
                                      {{ f.label }}:
                                    </span>
                                    <span class="text-grey-700 break-words">
                                      {{ f.value }}
                                    </span>
                                  </div>
                                }
                              </div>
                            } @else {
                              <p class="text-sm text-grey-400">
                                Esta notificación no envió variables.
                              </p>
                            }
                          </div>
                          @if (log.messageId) {
                            <div class="flex gap-2 text-xs">
                              <span class="text-grey-400 shrink-0">
                                Meta message ID:
                              </span>
                              <span
                                class="text-grey-600 font-mono break-all"
                              >
                                {{ log.messageId }}
                              </span>
                            </div>
                          }
                          @if (log.error) {
                            <div class="flex gap-2 text-xs">
                              <span class="text-grey-400 shrink-0">Error:</span>
                              <span class="text-red-600 break-words">
                                {{ log.error }}
                              </span>
                            </div>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr>
                    <td colspan="5" class="px-4 py-12 text-center">
                      <div class="flex flex-col items-center gap-2">
                        <ui-icon
                          name="message-circle"
                          size="28"
                          styleClass="text-grey-300"
                        />
                        <p class="text-sm text-grey-400">
                          No hay notificaciones que coincidan con el filtro.
                        </p>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class WhatsappLogs implements OnInit {
  protected readonly store = inject(WhatsappLogsStore);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly expandedId = signal<number | null>(null);

  protected readonly statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'sent', label: 'Enviadas' },
    { value: 'failed', label: 'Fallidas' },
    { value: 'skipped', label: 'Omitidas' },
  ];

  /** Mes más reciente con facturación reportada por Meta. */
  protected readonly latestMonthCost = computed(
    () => this.store.stats()?.months?.[0] ?? null
  );

  /** Meses anteriores (solo total) para comparar. */
  protected readonly previousMonthCosts = computed(
    () => this.store.stats()?.months?.slice(1) ?? []
  );

  /** Columnas de la tabla: últimos meses con envíos, en orden cronológico. */
  protected readonly monthColumns = computed(() => {
    const months = [...new Set(this.store.monthly().map((r) => r.month))];
    return months.sort().slice(-3);
  });

  /** Filas de la tabla: una por plantilla, con sus meses indexados. */
  protected readonly templateRows = computed(() => {
    const byTemplate = new Map<string, Map<string, WhatsappMonthlyRow>>();
    for (const row of this.store.monthly()) {
      const inner =
        byTemplate.get(row.templateType) ??
        new Map<string, WhatsappMonthlyRow>();
      inner.set(row.month, row);
      byTemplate.set(row.templateType, inner);
    }
    return [...byTemplate.entries()]
      .map(([templateType, months]) => ({
        templateType,
        category: TEMPLATE_CATEGORY[templateType] ?? null,
        months,
        total: [...months.values()].reduce((sum, r) => sum + r.sent, 0),
      }))
      .sort((a, b) => b.total - a.total);
  });

  protected monthTotal(month: string): number {
    return this.store
      .monthly()
      .filter((r) => r.month === month)
      .reduce((sum, r) => sum + r.sent, 0);
  }

  private static readonly MONTHS_ES = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];

  /** "2026-08" → "ago 2026". */
  protected monthLabel(ym: string): string {
    const [year, month] = ym.split('-').map(Number);
    return `${WhatsappLogs.MONTHS_ES[(month || 1) - 1]} ${year}`;
  }

  /** Categorías de un mes ordenadas por costo (la más cara primero). */
  protected categoryRows(
    m: WhatsappMonthCost
  ): { category: string; volume: number; cost: number }[] {
    return Object.entries(m.categories)
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }

  protected readonly filteredLogs = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.store.logs().filter((log) => {
      const matchesTerm =
        !term ||
        (log.recipient ?? '').toLowerCase().includes(term) ||
        (log.tenantName ?? '').toLowerCase().includes(term) ||
        (log.tenantSlug ?? '').toLowerCase().includes(term);
      const matchesStatus = status === 'all' || log.status === status;
      return matchesTerm && matchesStatus;
    });
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected toggle(log: WhatsappLog): void {
    this.expandedId.update((id) => (id === log.id ? null : log.id));
  }

  protected templateLabel = templateLabel;
  protected statusLabel = statusLabel;
  protected describeVariables = describeVariables;
  protected categoryLabel = categoryLabel;
}

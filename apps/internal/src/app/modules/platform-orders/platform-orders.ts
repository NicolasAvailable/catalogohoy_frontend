import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import { toast } from 'ngx-sonner';
import {
  CURRENCY_NAMES,
  orderStatusLabel,
  PlatformOrder,
  PlatformOrderStats,
  PlatformOrderStatus,
} from './platform-orders.model';
import { PlatformOrdersService } from './platform-orders.service';

type Tab = 'orders' | 'stats';
type StatusFilter = 'all' | PlatformOrderStatus;

@Component({
  selector: 'app-platform-orders',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, IconComponent],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-5 h-full min-h-0">
      <header class="flex items-start justify-between gap-4 shrink-0">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-bold text-grey-700">Órdenes</h1>
          <p class="text-sm text-grey-400">
            Todas las órdenes que pasan por la plataforma.
          </p>
        </div>
        <button
          type="button"
          (click)="reload()"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white border border-grey-50 hover:bg-grey-50 transition-colors cursor-pointer shrink-0"
          aria-label="Recargar"
        >
          <ui-icon name="refresh-cw" size="14" styleClass="text-grey-500" />
        </button>
      </header>

      <!-- Tabs -->
      <div class="flex items-center gap-1 border-b border-grey-50 shrink-0">
        @for (t of tabs; track t.value) {
          <button
            type="button"
            (click)="tab.set(t.value)"
            class="px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors cursor-pointer"
            [class.text-primary-600]="tab() === t.value"
            [class.border-primary-500]="tab() === t.value"
            [class.text-grey-400]="tab() !== t.value"
            [class.border-transparent]="tab() !== t.value"
            [class.hover:text-grey-600]="tab() !== t.value"
          >
            {{ t.label }}
          </button>
        }
      </div>

      @if (tab() === 'orders') {
        <!-- Search + status filter -->
        <section class="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          <div
            class="flex items-center gap-2 px-3 py-2 bg-white border border-grey-50 rounded-md flex-1 max-w-md"
          >
            <ui-icon name="search" size="16" styleClass="text-grey-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, catálogo o teléfono..."
              class="flex-1 outline-none text-sm text-grey-700 placeholder:text-grey-300 bg-transparent"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
            />
          </div>
          <div
            class="flex items-center gap-1 bg-white p-1 rounded-md border border-grey-50"
          >
            @for (f of statusFilters; track f.value) {
              <button
                type="button"
                (click)="statusFilter.set(f.value)"
                class="px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
                [class.bg-primary-500]="statusFilter() === f.value"
                [class.text-white]="statusFilter() === f.value"
                [class.text-grey-500]="statusFilter() !== f.value"
                [class.hover:bg-grey-50]="statusFilter() !== f.value"
              >
                {{ f.label }}
              </button>
            }
          </div>
        </section>

        <!-- Orders table -->
        <section
          class="flex-1 min-h-0 bg-white rounded-xl border border-grey-50 overflow-hidden flex flex-col"
        >
          <div class="flex-1 min-h-0 overflow-auto">
            <table class="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">
                    Pedido
                  </th>
                  <th class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">
                    Catálogo
                  </th>
                  <th class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">
                    Estado
                  </th>
                  <th class="sticky top-0 z-10 text-right text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">
                    Total
                  </th>
                  <th class="sticky top-0 z-10 text-right text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                @if (isLoadingOrders()) {
                  <tr>
                    <td colspan="5" class="px-4 py-12 text-center">
                      <div class="flex flex-col items-center gap-2">
                        <ui-icon
                          name="loader-circle"
                          size="24"
                          styleClass="text-grey-300 animate-spin"
                        />
                        <p class="text-sm text-grey-400">Cargando órdenes...</p>
                      </div>
                    </td>
                  </tr>
                } @else {
                  @for (o of filteredOrders(); track o.id) {
                    <tr class="hover:bg-grey-25 transition-colors align-top">
                      <td class="px-4 py-3 border-b border-grey-50">
                        <div class="flex flex-col min-w-0">
                          <span class="font-medium text-grey-700 truncate">
                            {{ o.customerName || 'Sin nombre' }}
                          </span>
                          <span class="text-xs text-grey-400">
                            #{{ o.orderNumber ?? o.id }} · {{ o.itemCount }}
                            {{ o.itemCount === 1 ? 'ítem' : 'ítems' }}
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-3 border-b border-grey-50">
                        <div class="flex flex-col min-w-0">
                          <span class="text-grey-700 truncate">
                            {{ o.tenantName || '—' }}
                          </span>
                          @if (o.tenantSlug) {
                            <span class="text-xs text-grey-400 truncate">
                              /{{ o.tenantSlug }}
                            </span>
                          }
                        </div>
                      </td>
                      <td class="px-4 py-3 border-b border-grey-50">
                        <span
                          class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                          [class.bg-emerald-50]="o.status === 'completed'"
                          [class.text-emerald-600]="o.status === 'completed'"
                          [class.bg-amber-50]="o.status === 'pending'"
                          [class.text-amber-600]="o.status === 'pending'"
                          [class.bg-red-50]="o.status === 'cancelled'"
                          [class.text-red-600]="o.status === 'cancelled'"
                        >
                          {{ statusLabel(o.status) }}
                        </span>
                      </td>
                      <td
                        class="px-4 py-3 text-right border-b border-grey-50 whitespace-nowrap"
                      >
                        <span class="font-semibold text-grey-700">
                          {{ o.totalUsd | number: '1.2-2' }}
                          <span class="text-xs text-grey-400 font-normal">
                            {{ o.currency }}
                          </span>
                        </span>
                        @if (o.totalBs > 0 && o.currency !== 'VES') {
                          <span class="block text-xs text-grey-400">
                            Bs {{ o.totalBs | number: '1.2-2' }}
                          </span>
                        }
                      </td>
                      <td
                        class="px-4 py-3 text-right text-grey-500 border-b border-grey-50 whitespace-nowrap"
                      >
                        {{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="px-4 py-12 text-center">
                        <div class="flex flex-col items-center gap-2">
                          <ui-icon
                            name="shopping-bag"
                            size="28"
                            styleClass="text-grey-300"
                          />
                          <p class="text-sm text-grey-400">
                            No hay órdenes que coincidan con el filtro.
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
      } @else if (stats(); as s) {
        <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 pb-1">
          <!-- KPI cards -->
          <section class="grid grid-cols-2 lg:grid-cols-5 gap-4">
            @for (kpi of kpis(); track kpi.label) {
              <article
                class="flex flex-col gap-1 p-4 bg-white rounded-xl border border-grey-50"
              >
                <span class="text-xs text-grey-400 uppercase tracking-wide">
                  {{ kpi.label }}
                </span>
                <strong class="text-2xl font-bold text-grey-700">
                  {{ kpi.value }}
                </strong>
                @if (kpi.hint) {
                  <span class="text-xs text-grey-400">{{ kpi.hint }}</span>
                }
              </article>
            }
          </section>

          <!-- Status breakdown -->
          <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <article
              class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
            >
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span class="text-sm text-grey-500 flex-1">Pendientes</span>
              <strong class="font-bold text-grey-700">{{ s.pending }}</strong>
            </article>
            <article
              class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
            >
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span class="text-sm text-grey-500 flex-1">Completadas</span>
              <strong class="font-bold text-grey-700">{{ s.completed }}</strong>
            </article>
            <article
              class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
            >
              <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span class="text-sm text-grey-500 flex-1">Canceladas</span>
              <strong class="font-bold text-grey-700">{{ s.cancelled }}</strong>
            </article>
          </section>

          <!-- Ingresos por moneda -->
          <section
            class="bg-white border border-grey-50 rounded-xl overflow-hidden"
          >
            <div class="p-4 border-b border-grey-50 flex items-center justify-between gap-2">
              <h2 class="text-sm font-bold text-grey-600">
                Ingresos por moneda (completadas)
              </h2>
              <span class="text-xs text-grey-400">
                Cada catálogo vende en su propia moneda — no se pueden sumar
              </span>
            </div>
            @if (s.revenueByCurrency.length === 0) {
              <p class="text-sm text-grey-400 p-4">Sin órdenes completadas.</p>
            } @else {
              <table class="w-full text-left text-sm">
                <tbody>
                  @for (c of s.revenueByCurrency; track c.currency) {
                    <tr class="border-b border-grey-50 last:border-0">
                      <td class="px-4 py-2.5 w-20">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded bg-grey-50 text-grey-600 text-xs font-bold"
                        >
                          {{ c.currency }}
                        </span>
                      </td>
                      <td class="px-4 py-2.5 text-grey-500">
                        {{ currencyName(c.currency) }}
                      </td>
                      <td class="px-4 py-2.5 text-right text-grey-400 whitespace-nowrap">
                        {{ c.orders }}
                        {{ c.orders === 1 ? 'orden' : 'órdenes' }}
                      </td>
                      <td class="px-4 py-2.5 text-right font-bold text-grey-700 whitespace-nowrap">
                        {{ c.total | number: '1.0-2' }}
                        <span class="text-xs text-grey-400 font-normal">
                          {{ c.currency }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>

          <!-- Daily chart -->
          <section
            class="bg-white border border-grey-50 rounded-xl p-5 flex flex-col gap-3"
          >
            <h2 class="text-sm font-bold text-grey-600">
              Órdenes por día (últimos 30 días)
            </h2>
            @if (s.daily.length === 0) {
              <p class="text-sm text-grey-400">Sin órdenes en el período.</p>
            } @else {
              <div class="flex items-end gap-1 h-40">
                @for (d of s.daily; track d.date) {
                  <div
                    class="flex-1 bg-primary-400 rounded-t hover:bg-primary-500 transition-colors min-h-[2px]"
                    [style.height.%]="barHeight(d.count)"
                    [title]="d.date + ': ' + d.count"
                  ></div>
                }
              </div>
            }
          </section>

          <!-- Top tenants -->
          <section
            class="bg-white border border-grey-50 rounded-xl overflow-hidden"
          >
            <h2 class="text-sm font-bold text-grey-600 p-4 border-b border-grey-50">
              Catálogos con más órdenes
            </h2>
            @if (s.topTenants.length === 0) {
              <p class="text-sm text-grey-400 p-4">Sin datos.</p>
            } @else {
              <table class="w-full text-left text-sm">
                <tbody>
                  @for (t of s.topTenants; track t.slug) {
                    <tr class="border-b border-grey-50 last:border-0">
                      <td class="px-4 py-2.5 text-grey-400 w-8">
                        {{ $index + 1 }}
                      </td>
                      <td class="px-4 py-2.5 font-semibold text-grey-700">
                        {{ t.name || t.slug || '—' }}
                        @if (t.slug) {
                          <span class="text-grey-400 font-normal text-xs">
                            /{{ t.slug }}
                          </span>
                        }
                      </td>
                      <td class="px-4 py-2.5 text-right font-bold text-primary-600">
                        {{ t.orders }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        </div>
      } @else {
        <p class="text-sm text-grey-400">Cargando estadísticas...</p>
      }
    </div>
  `,
})
export class PlatformOrders implements OnInit {
  private readonly service = inject(PlatformOrdersService);

  public readonly tab = signal<Tab>('orders');
  public readonly stats = signal<PlatformOrderStats | null>(null);
  public readonly orders = signal<PlatformOrder[]>([]);
  public readonly isLoadingOrders = signal(false);

  public readonly searchTerm = signal('');
  public readonly statusFilter = signal<StatusFilter>('all');

  public readonly tabs: { value: Tab; label: string }[] = [
    { value: 'orders', label: 'Órdenes' },
    { value: 'stats', label: 'Volumen' },
  ];

  public readonly statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'completed', label: 'Completadas' },
    { value: 'cancelled', label: 'Canceladas' },
  ];

  public readonly filteredOrders = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.orders().filter((o) => {
      const matchesTerm =
        !term ||
        (o.customerName ?? '').toLowerCase().includes(term) ||
        (o.tenantName ?? '').toLowerCase().includes(term) ||
        (o.tenantSlug ?? '').toLowerCase().includes(term) ||
        (o.phone ?? '').toLowerCase().includes(term);
      const matchesStatus = status === 'all' || o.status === status;
      return matchesTerm && matchesStatus;
    });
  });

  public readonly kpis = computed(
    (): { label: string; value: string; hint?: string }[] => {
      const s = this.stats();
      if (!s) return [];
      const otherCurrencies = s.revenueByCurrency.filter(
        (c) => c.currency !== 'USD'
      ).length;
      return [
        { label: 'Total', value: `${s.total}` },
        { label: 'Hoy', value: `${s.today}` },
        { label: '7 días', value: `${s.last7}` },
        { label: '30 días', value: `${s.last30}` },
        {
          label: 'Ingresos USD (compl.)',
          value: `$${this.money(s.revenueUsd)}`,
          hint:
            otherCurrencies > 0
              ? `solo catálogos en USD · +${otherCurrencies} monedas abajo`
              : 'solo catálogos en USD',
        },
      ];
    }
  );

  private readonly maxDaily = computed(() =>
    Math.max(1, ...(this.stats()?.daily.map((d) => d.count) ?? [1]))
  );

  ngOnInit(): void {
    this.loadOrders();
    this.loadStats();
  }

  reload(): void {
    this.loadOrders();
    this.loadStats();
  }

  async loadOrders(): Promise<void> {
    this.isLoadingOrders.set(true);
    const res = await this.service.listOrders();
    res.fold(
      (e) => {
        toast.error(e.message);
      },
      (o) => this.orders.set(o)
    );
    this.isLoadingOrders.set(false);
  }

  async loadStats(): Promise<void> {
    const res = await this.service.getStats();
    res.fold(
      (e) => {
        toast.error(e.message);
      },
      (s) => this.stats.set(s)
    );
  }

  barHeight(count: number): number {
    return Math.round((count / this.maxDaily()) * 100);
  }

  private money(value: number): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  protected currencyName(code: string): string {
    return CURRENCY_NAMES[code] ?? code;
  }

  protected statusLabel = orderStatusLabel;
}

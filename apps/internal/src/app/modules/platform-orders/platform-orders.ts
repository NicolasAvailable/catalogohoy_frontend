import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ButtonComponent, IconComponent } from '@ui';
import { toast } from 'ngx-sonner';
import { PlatformOrderStats } from './platform-orders.model';
import { PlatformOrdersService } from './platform-orders.service';

@Component({
  selector: 'app-platform-orders',
  standalone: true,
  imports: [IconComponent, ButtonComponent],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0 p-1 overflow-y-auto">
      <header class="flex items-start justify-between gap-4 shrink-0">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-bold text-grey-700">Órdenes</h1>
          <p class="text-sm text-grey-400">
            Cuántas órdenes pasan por toda la plataforma.
          </p>
        </div>
        <ui-button
          label="Refrescar"
          icon="refresh-cw"
          variant="outlined"
          severity="contrast"
          size="small"
          [fluid]="false"
          (click)="load()"
        />
      </header>

      @if (isLoading() && !stats()) {
      <p class="text-sm text-grey-400">Cargando…</p>
      } @else if (stats(); as s) {
      <!-- KPI cards -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
        @for (kpi of kpis(); track kpi.label) {
        <div class="bg-white border border-grey-100 rounded-xl p-4 flex flex-col gap-1">
          <span class="text-xs font-semibold text-grey-400 uppercase tracking-wide">
            {{ kpi.label }}
          </span>
          <span class="text-2xl font-bold text-grey-800">{{ kpi.value }}</span>
        </div>
        }
      </div>

      <!-- Status breakdown -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="bg-white border border-grey-100 rounded-xl p-4 flex items-center gap-3">
          <span class="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
          <span class="text-sm text-grey-500 flex-1">Pendientes</span>
          <span class="font-bold text-grey-800">{{ s.pending }}</span>
        </div>
        <div class="bg-white border border-grey-100 rounded-xl p-4 flex items-center gap-3">
          <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
          <span class="text-sm text-grey-500 flex-1">Completadas</span>
          <span class="font-bold text-grey-800">{{ s.completed }}</span>
        </div>
        <div class="bg-white border border-grey-100 rounded-xl p-4 flex items-center gap-3">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          <span class="text-sm text-grey-500 flex-1">Canceladas</span>
          <span class="font-bold text-grey-800">{{ s.cancelled }}</span>
        </div>
      </div>

      <!-- Daily chart (last 30 days) -->
      <div class="bg-white border border-grey-100 rounded-xl p-5 flex flex-col gap-3">
        <h2 class="text-sm font-bold text-grey-600">Órdenes por día (últimos 30 días)</h2>
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
      </div>

      <!-- Top tenants -->
      <div class="bg-white border border-grey-100 rounded-xl overflow-hidden">
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
              <td class="px-4 py-2.5 text-grey-300 w-8">{{ $index + 1 }}</td>
              <td class="px-4 py-2.5 font-semibold text-grey-800">
                {{ t.name || t.slug || '—' }}
                @if (t.slug) {
                <span class="text-grey-300 font-normal text-xs">/{{ t.slug }}</span>
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
      </div>
      }
    </div>
  `,
})
export class PlatformOrders implements OnInit {
  private readonly service = inject(PlatformOrdersService);

  public readonly stats = signal<PlatformOrderStats | null>(null);
  public readonly isLoading = signal(false);

  public readonly kpis = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Total', value: `${s.total}` },
      { label: 'Hoy', value: `${s.today}` },
      { label: '7 días', value: `${s.last7}` },
      { label: '30 días', value: `${s.last30}` },
      {
        label: 'Ingresos (compl.)',
        value: `$${new DecimalPipe('en-US').transform(s.revenueUsd, '1.2-2')}`,
      },
    ];
  });

  private readonly maxDaily = computed(() =>
    Math.max(1, ...(this.stats()?.daily.map((d) => d.count) ?? [1]))
  );

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    const res = await this.service.getStats();
    res.fold(
      (e) => {
        toast.error(e.message);
      },
      (s) => this.stats.set(s)
    );
    this.isLoading.set(false);
  }

  barHeight(count: number): number {
    return Math.round((count / this.maxDaily()) * 100);
  }
}

import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import {
  FEATURE_FILTERS,
  featureIcon,
  featureLabel,
} from './ai-usage.model';
import { AiUsageStore } from './ai-usage.store';

@Component({
  selector: 'app-ai-usage',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Uso de IA</h1>
        <p class="text-sm text-grey-400">
          Consumo de créditos de IA entre todos los usuarios: qué generó cada
          uno y con qué prompt. El registro acumula desde que se activó el
          logueo.
        </p>
      </header>

      <!-- Métricas -->
      <section class="grid grid-cols-2 sm:grid-cols-3 gap-4 shrink-0">
        <article class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-50">
            <ui-icon name="sparkles" size="18" styleClass="text-violet-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Créditos consumidos</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.stats()?.totalCredits ?? 0 }}
            </strong>
          </div>
        </article>
        <article class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-grey-50">
            <ui-icon name="zap" size="18" styleClass="text-grey-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Generaciones</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.stats()?.totalGenerations ?? 0 }}
            </strong>
          </div>
        </article>
        <article class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50">
            <ui-icon name="users" size="18" styleClass="text-emerald-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Usuarios</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.stats()?.usersCount ?? 0 }}
            </strong>
          </div>
        </article>
      </section>

      <!-- Por feature + Top usuarios -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
        <div class="bg-white rounded-xl border border-grey-50 p-4">
          <h2 class="text-sm font-semibold text-grey-600 mb-3">Por herramienta</h2>
          @if (store.stats()?.byFeature?.length) {
            <div class="flex flex-col gap-3">
              @for (f of store.stats()!.byFeature; track f.feature) {
                <div class="flex items-center gap-3">
                  <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-grey-50 shrink-0">
                    <ui-icon [name]="featureIcon(f.feature)" size="15" styleClass="text-grey-500" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm text-grey-700 truncate">{{ featureLabel(f.feature) }}</span>
                      <span class="text-sm font-semibold text-grey-700 shrink-0">{{ f.credits }} cr.</span>
                    </div>
                    <div class="h-1.5 mt-1 rounded-full bg-grey-50 overflow-hidden">
                      <div
                        class="h-full rounded-full bg-violet-400"
                        [style.width.%]="barWidth(f.credits)"
                      ></div>
                    </div>
                  </div>
                  <span class="text-xs text-grey-400 shrink-0 w-16 text-right">{{ f.generations }} gen.</span>
                </div>
              }
            </div>
          } @else {
            <p class="text-sm text-grey-400">Sin datos todavía.</p>
          }
        </div>

        <div class="bg-white rounded-xl border border-grey-50 p-4">
          <h2 class="text-sm font-semibold text-grey-600 mb-3">Top usuarios</h2>
          @if (store.stats()?.topUsers?.length) {
            <div class="flex flex-col">
              @for (u of store.stats()!.topUsers.slice(0, 6); track u.userId) {
                <div class="flex items-center gap-3 py-1.5 border-b border-grey-25 last:border-0">
                  <div class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-50 text-primary-600 text-xs font-bold shrink-0">
                    {{ initial(u.userName || u.userEmail) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="block text-sm text-grey-700 truncate">{{ u.userName || u.userEmail || '—' }}</span>
                    @if (u.userName && u.userEmail) {
                      <span class="block text-xs text-grey-400 truncate">{{ u.userEmail }}</span>
                    }
                  </div>
                  <div class="text-right shrink-0">
                    <span class="block text-sm font-semibold text-grey-700">{{ u.credits }} cr.</span>
                    <span class="block text-xs text-grey-400">{{ u.generations }} gen.</span>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="text-sm text-grey-400">Sin datos todavía.</p>
          }
        </div>
      </section>

      <!-- Filtros -->
      <section class="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
        <div class="flex items-center gap-2 px-3 py-2 bg-white border border-grey-50 rounded-md flex-1 max-w-md">
          <ui-icon name="search" size="16" styleClass="text-grey-400" />
          <input
            type="text"
            placeholder="Buscar por usuario o prompt..."
            class="flex-1 outline-none text-sm text-grey-700 placeholder:text-grey-300 bg-transparent"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
        </div>
        <div class="flex items-center gap-1 bg-white p-1 rounded-md border border-grey-50 flex-wrap">
          @for (filter of featureFilters; track filter.value) {
            <button
              type="button"
              (click)="featureFilter.set(filter.value)"
              class="px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
              [class.bg-primary-500]="featureFilter() === filter.value"
              [class.text-white]="featureFilter() === filter.value"
              [class.text-grey-500]="featureFilter() !== filter.value"
              [class.hover:bg-grey-50]="featureFilter() !== filter.value"
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
        <div class="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 border border-red-100 shrink-0">
          <ui-icon name="circle-alert" size="16" styleClass="text-red-500" />
          <span class="text-sm text-red-600">{{ store.error() }}</span>
        </div>
      }

      <!-- Log -->
      <section class="flex-1 min-h-0 bg-white rounded-xl border border-grey-50 overflow-hidden flex flex-col">
        <div class="flex-1 min-h-0 overflow-auto">
          <table class="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">Usuario</th>
                <th class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">Herramienta</th>
                <th class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">Prompt</th>
                <th class="sticky top-0 z-10 text-right text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">Créditos</th>
                <th class="sticky top-0 z-10 text-right text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">Fecha</th>
              </tr>
            </thead>
            <tbody>
              @if (store.isLoading()) {
                <tr>
                  <td colspan="5" class="px-4 py-12 text-center">
                    <div class="flex flex-col items-center gap-2">
                      <ui-icon name="loader-circle" size="24" styleClass="text-grey-300 animate-spin" />
                      <p class="text-sm text-grey-400">Cargando uso de IA...</p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (log of filteredLogs(); track log.id) {
                  <tr class="hover:bg-grey-25 transition-colors align-top">
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-col min-w-0">
                        <span class="text-grey-700 truncate">{{ log.userName || '—' }}</span>
                        @if (log.userEmail) {
                          <span class="text-xs text-grey-400 truncate">{{ log.userEmail }}</span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50 whitespace-nowrap">
                      <span class="inline-flex items-center gap-1.5 text-grey-700">
                        <ui-icon [name]="featureIcon(log.feature)" size="14" styleClass="text-grey-400" />
                        {{ featureLabel(log.feature) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      @if (log.prompt) {
                        <p class="text-grey-600 max-w-md whitespace-pre-wrap break-words line-clamp-3" [title]="log.prompt">
                          {{ log.prompt }}
                        </p>
                      } @else {
                        <span class="text-grey-300">—</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right border-b border-grey-50 whitespace-nowrap">
                      <span class="font-semibold text-grey-700">{{ log.credits }}</span>
                    </td>
                    <td class="px-4 py-3 text-right text-grey-500 border-b border-grey-50 whitespace-nowrap">
                      {{ log.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-4 py-12 text-center">
                      <div class="flex flex-col items-center gap-2">
                        <ui-icon name="sparkles" size="28" styleClass="text-grey-300" />
                        <p class="text-sm text-grey-400">No hay registros de uso que coincidan.</p>
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
export class AiUsage implements OnInit {
  protected readonly store = inject(AiUsageStore);

  protected readonly searchTerm = signal('');
  protected readonly featureFilter = signal<string | null>(null);
  protected readonly featureFilters = FEATURE_FILTERS;

  protected readonly filteredLogs = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const feature = this.featureFilter();
    return this.store.logs().filter((log) => {
      const matchesFeature = !feature || log.feature === feature;
      const matchesTerm =
        !term ||
        (log.userName ?? '').toLowerCase().includes(term) ||
        (log.userEmail ?? '').toLowerCase().includes(term) ||
        (log.prompt ?? '').toLowerCase().includes(term);
      return matchesFeature && matchesTerm;
    });
  });

  /** Width % of a feature bar relative to the biggest feature by credits. */
  protected barWidth(credits: number): number {
    const max = Math.max(
      1,
      ...(this.store.stats()?.byFeature.map((f) => f.credits) ?? [1])
    );
    return Math.round((credits / max) * 100);
  }

  protected initial(name: string | null): string {
    return (name?.trim()?.[0] ?? '?').toUpperCase();
  }

  ngOnInit(): void {
    this.store.load();
  }

  protected featureLabel = featureLabel;
  protected featureIcon = featureIcon;
}

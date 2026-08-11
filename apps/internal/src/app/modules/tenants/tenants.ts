import { DatePipe } from '@angular/common';
import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import { cycleLabel, tierLabel } from '../shared/plan-cycle.model';
import { countryLabel } from '../shared/country.util';
import {
  AssignPlanDialog,
  AssignPlanPayload,
} from './components/assign-plan-dialog/assign-plan-dialog';
import { Tenant } from './tenants.model';
import { TenantsStore } from './tenants.store';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe, AssignPlanDialog],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Catálogos</h1>
        <p class="text-sm text-grey-400">
          Todos los catálogos (tenants) registrados. Asigná un plan y la
          frecuencia de cobro a cada catálogo.
        </p>
      </header>

      <section class="flex items-center gap-3 shrink-0">
        <div
          class="flex items-center gap-2 px-3 py-2 bg-white border border-grey-50 rounded-md flex-1 max-w-md"
        >
          <ui-icon name="search" size="16" styleClass="text-grey-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, slug o dueño..."
            class="flex-1 outline-none text-sm text-grey-700 placeholder:text-grey-300 bg-transparent"
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchChange($event)"
          />
        </div>
        <span class="text-sm text-grey-400">
          {{ store.tenants().length }} de {{ store.total() }}
        </span>
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
                  Catálogo
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Dueño
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  País
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Registro
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Plan activo
                </th>
                <th
                  class="sticky top-0 z-10 text-right text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              @if (store.isLoading()) {
                <tr>
                  <td colspan="6" class="px-4 py-12 text-center">
                    <div class="flex flex-col items-center gap-2">
                      <ui-icon
                        name="loader-circle"
                        size="24"
                        styleClass="text-grey-300 animate-spin"
                      />
                      <p class="text-sm text-grey-400">Cargando catálogos...</p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (tenant of store.tenants(); track tenant.id) {
                  <tr class="hover:bg-grey-25 transition-colors">
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex items-center gap-3">
                        @if (tenant.logo && !brokenLogos().has(tenant.id)) {
                          <img
                            [src]="tenant.logo"
                            [alt]="tenant.name ?? ''"
                            referrerpolicy="no-referrer"
                            (error)="onLogoError(tenant.id)"
                            class="w-10 h-10 rounded-lg object-cover shrink-0 border border-grey-50"
                          />
                        } @else {
                          <div
                            class="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center shrink-0 text-white text-sm font-semibold uppercase"
                          >
                            {{ initial(tenant) }}
                          </div>
                        }
                        <div class="flex flex-col min-w-0">
                          <strong class="font-semibold text-grey-700 truncate">
                            {{ tenant.name ?? 'Sin nombre' }}
                          </strong>
                          @if (tenant.slug) {
                            <span class="text-xs text-grey-400 truncate">
                              {{ tenant.slug }}.catalogohoy.com
                            </span>
                          }
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-col">
                        @if (tenant.ownerName) {
                          <span class="text-grey-700">{{ tenant.ownerName }}</span>
                        }
                        @if (tenant.ownerEmail) {
                          <span class="text-xs text-grey-400">{{ tenant.ownerEmail }}</span>
                        }
                        @if (!tenant.ownerName && !tenant.ownerEmail) {
                          <span class="text-xs text-grey-400">Sin dueño</span>
                        }
                      </div>
                    </td>
                    <td
                      class="px-4 py-3 text-grey-600 border-b border-grey-50 whitespace-nowrap"
                    >
                      {{ countryLabel(tenant.countryCode) }}
                    </td>
                    <td class="px-4 py-3 text-grey-500 border-b border-grey-50">
                      {{ tenant.createdAt | date: 'dd/MM/yyyy' }}
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      @let plan = tenant.plan;
                      @if (plan.tier === 'gratis') {
                        <div class="flex flex-col gap-1">
                          <span
                            class="inline-flex items-center px-2 py-1 rounded bg-grey-50 text-grey-500 text-xs font-semibold w-fit"
                          >
                            Gratis
                          </span>
                          <div class="flex flex-col text-[10px] text-grey-400 leading-tight">
                            <span>
                              Desde:
                              {{ plan.startedAt | date: 'dd/MM/yyyy' }}
                            </span>
                            <span>Sin expiración</span>
                          </div>
                        </div>
                      } @else {
                        <div class="flex flex-col gap-1">
                          <div class="flex items-center gap-2">
                            <span
                              class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                              [class.bg-emerald-50]="!plan.expired"
                              [class.text-emerald-600]="!plan.expired"
                              [class.bg-red-50]="plan.expired"
                              [class.text-red-600]="plan.expired"
                            >
                              <ui-icon
                                [name]="plan.expired ? 'circle-alert' : 'check-circle'"
                                size="10"
                                [styleClass]="plan.expired ? 'text-red-500' : 'text-emerald-500'"
                              />
                              {{ tierLabel(plan.tier) }}
                            </span>
                            @if (plan.cycle) {
                              <span class="text-xs text-grey-400">
                                {{ cycleLabel(plan.cycle) }}
                              </span>
                            }
                          </div>
                          <div class="flex flex-col text-[10px] text-grey-400 leading-tight">
                            <span>
                              Inicio:
                              {{ plan.startedAt | date: 'dd/MM/yyyy' }}
                            </span>
                            @if (plan.expiresAt) {
                              <span>
                                Vence:
                                {{ plan.expiresAt | date: 'dd/MM/yyyy' }}
                              </span>
                            }
                          </div>
                        </div>
                      }
                    </td>
                    <td class="px-4 py-3 text-right border-b border-grey-50">
                      <button
                        type="button"
                        (click)="openAssignDialog(tenant)"
                        [disabled]="store.isMutating()"
                        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors cursor-pointer text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ui-icon
                          name="crown"
                          size="12"
                          styleClass="text-primary-500"
                        />
                        {{ tenant.plan.tier === 'gratis' ? 'Asignar plan' : 'Editar plan' }}
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="px-4 py-12 text-center">
                      <div class="flex flex-col items-center gap-2">
                        <ui-icon
                          name="store"
                          size="28"
                          styleClass="text-grey-300"
                        />
                        <p class="text-sm text-grey-400">
                          No hay catálogos para mostrar.
                        </p>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (!store.isLoading() && store.tenants().length < store.total()) {
          <div class="shrink-0 border-t border-grey-50 p-3 flex justify-center">
            <button
              type="button"
              (click)="store.loadMore()"
              [disabled]="store.isLoadingMore()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-grey-50 hover:bg-grey-50 transition-colors cursor-pointer text-sm font-semibold text-grey-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (store.isLoadingMore()) {
                <ui-icon name="loader-circle" size="14" styleClass="text-grey-400 animate-spin" />
                Cargando...
              } @else {
                <ui-icon name="chevron-down" size="14" styleClass="text-grey-500" />
                Cargar más ({{ store.tenants().length }} de {{ store.total() }})
              }
            </button>
          </div>
        }
      </section>
    </div>

    <app-assign-plan-dialog
      (assign)="onAssign($event)"
      (remove)="onRemove($event)"
    />
  `,
})
export class Tenants implements OnInit, OnDestroy {
  protected readonly store = inject(TenantsStore);

  protected readonly searchTerm = signal('');
  protected readonly brokenLogos = signal<Set<number>>(new Set());

  private readonly dialog = viewChild.required(AssignPlanDialog);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.store.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  /** Debounce keystrokes so search hits the server (not the loaded page). */
  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setSearch(term), 300);
  }

  protected openAssignDialog(tenant: Tenant): void {
    this.dialog().show(tenant);
  }

  protected async onAssign(payload: AssignPlanPayload): Promise<void> {
    await this.store.assignPlan(
      payload.tenantId,
      payload.tier,
      payload.cycle,
      payload.amountUsd,
      payload.consumeCreditUsd
    );
  }

  protected async onRemove(tenantId: number): Promise<void> {
    await this.store.removePlan(tenantId);
  }

  protected onLogoError(tenantId: number): void {
    this.brokenLogos.update((set) => {
      const next = new Set(set);
      next.add(tenantId);
      return next;
    });
  }

  protected initial(tenant: Tenant): string {
    const source = tenant.name ?? tenant.slug ?? '?';
    return source.trim().charAt(0).toUpperCase() || '?';
  }

  protected tierLabel = tierLabel;
  protected countryLabel = countryLabel;
  protected cycleLabel = cycleLabel;
}

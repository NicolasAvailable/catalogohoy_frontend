import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import { cycleLabel, tierLabel } from '../shared/plan-cycle.model';
import { ClientDetailDialog } from './components/client-detail-dialog/client-detail-dialog';
import { ImpersonateTenantService } from './impersonate-tenant.service';
import {
  computeStatus,
  PayingClient,
  PayingClientStatus,
} from './paying-clients.model';
import { PayingClientsStore } from './paying-clients.store';

type StatusFilter = 'all' | PayingClientStatus;

@Component({
  selector: 'app-paying-clients',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe, ClientDetailDialog],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Clientes pagos</h1>
        <p class="text-sm text-grey-400">
          Catálogos con suscripción activa. Click en un cliente para ver el
          historial de planes que ha tenido.
        </p>
      </header>

      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50"
          >
            <ui-icon
              name="check-circle"
              size="18"
              styleClass="text-emerald-500"
            />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Activos</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().active }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50"
          >
            <ui-icon name="clock" size="18" styleClass="text-amber-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Por vencer (≤7 días)</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().expiring }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50"
          >
            <ui-icon
              name="circle-alert"
              size="18"
              styleClass="text-red-500"
            />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Vencidos</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().expired }}
            </strong>
          </div>
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
            placeholder="Buscar por catálogo, dueño o email..."
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

      @if (impersonateError()) {
        <div
          class="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 border border-red-100 shrink-0"
        >
          <ui-icon name="circle-alert" size="16" styleClass="text-red-500" />
          <span class="text-sm text-red-600">{{ impersonateError() }}</span>
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
                  Cliente
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Plan
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Vence
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Estado
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
                  <td colspan="5" class="px-4 py-12 text-center">
                    <div class="flex flex-col items-center gap-2">
                      <ui-icon
                        name="loader-circle"
                        size="24"
                        styleClass="text-grey-300 animate-spin"
                      />
                      <p class="text-sm text-grey-400">Cargando clientes...</p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (client of filteredClients(); track client.tenantId) {
                  <tr
                    class="hover:bg-grey-25 transition-colors cursor-pointer"
                    (click)="openDetail(client)"
                  >
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex items-center gap-3">
                        @if (client.tenantLogo) {
                          <img
                            [src]="client.tenantLogo"
                            [alt]="client.tenantName ?? ''"
                            referrerpolicy="no-referrer"
                            class="w-10 h-10 rounded-lg object-cover shrink-0 border border-grey-50"
                          />
                        } @else {
                          <div
                            class="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center shrink-0 text-white text-sm font-semibold uppercase"
                          >
                            {{ initial(client) }}
                          </div>
                        }
                        <div class="flex flex-col min-w-0">
                          <strong class="font-semibold text-grey-700 truncate">
                            {{ client.tenantName ?? 'Sin nombre' }}
                          </strong>
                          <span class="text-xs text-grey-400 truncate">
                            {{ client.ownerName ?? '—' }} ·
                            {{ client.ownerEmail ?? '—' }}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-col">
                        <span class="font-semibold text-grey-700">
                          {{ tierLabel(client.tier) }}
                        </span>
                        @if (client.cycle) {
                          <span class="text-xs text-grey-400">
                            {{ cycleLabel(client.cycle) }}
                          </span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 text-grey-500 border-b border-grey-50">
                      @if (client.expiresAt) {
                        <div class="flex flex-col">
                          <span class="text-grey-700">
                            {{ client.expiresAt | date: 'dd/MM/yyyy' }}
                          </span>
                          @if (client.daysUntilExpiry !== null) {
                            <span class="text-xs text-grey-400">
                              @if (client.daysUntilExpiry < 0) {
                                Hace {{ -client.daysUntilExpiry }}d
                              } @else {
                                En {{ client.daysUntilExpiry }}d
                              }
                            </span>
                          }
                        </div>
                      } @else {
                        —
                      }
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      @let status = computeStatus(client.daysUntilExpiry);
                      <span
                        class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                        [class.bg-emerald-50]="status === 'active'"
                        [class.text-emerald-600]="status === 'active'"
                        [class.bg-amber-50]="status === 'expiring'"
                        [class.text-amber-600]="status === 'expiring'"
                        [class.bg-red-50]="status === 'expired'"
                        [class.text-red-600]="status === 'expired'"
                      >
                        {{ statusLabel(status) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right border-b border-grey-50">
                      <div class="inline-flex items-center gap-2">
                        <button
                          type="button"
                          (click)="
                            enterAsAdmin(client); $event.stopPropagation()
                          "
                          [disabled]="impersonatingId() === client.tenantId"
                          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          @if (impersonatingId() === client.tenantId) {
                            <ui-icon
                              name="loader-circle"
                              size="12"
                              styleClass="text-emerald-500 animate-spin"
                            />
                          } @else {
                            <ui-icon
                              name="log-in"
                              size="12"
                              styleClass="text-emerald-500"
                            />
                          }
                          Entrar como admin
                        </button>
                        <button
                          type="button"
                          (click)="openDetail(client); $event.stopPropagation()"
                          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors cursor-pointer text-xs font-semibold"
                        >
                          <ui-icon
                            name="eye"
                            size="12"
                            styleClass="text-primary-500"
                          />
                          Ver detalle
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-4 py-12 text-center">
                      <div class="flex flex-col items-center gap-2">
                        <ui-icon
                          name="credit-card"
                          size="28"
                          styleClass="text-grey-300"
                        />
                        <p class="text-sm text-grey-400">
                          Todavía no hay catálogos con plan activo. Asigná un
                          plan desde la sección Catálogos.
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

    <app-client-detail-dialog />
  `,
})
export class PayingClients implements OnInit {
  protected readonly store = inject(PayingClientsStore);
  private readonly impersonateService = inject(ImpersonateTenantService);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly impersonatingId = signal<number | null>(null);
  protected readonly impersonateError = signal<string | null>(null);

  protected readonly statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'expiring', label: 'Por vencer' },
    { value: 'expired', label: 'Vencidos' },
  ];

  private readonly detailDialog = viewChild.required(ClientDetailDialog);

  protected readonly filteredClients = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.store.clients().filter((c) => {
      const matchesTerm =
        !term ||
        (c.tenantName ?? '').toLowerCase().includes(term) ||
        (c.tenantSlug ?? '').toLowerCase().includes(term) ||
        (c.ownerName ?? '').toLowerCase().includes(term) ||
        (c.ownerEmail ?? '').toLowerCase().includes(term);
      const matchesStatus =
        status === 'all' || computeStatus(c.daysUntilExpiry) === status;
      return matchesTerm && matchesStatus;
    });
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected async openDetail(client: PayingClient): Promise<void> {
    await this.store.openDetail(client.tenantId);
    this.detailDialog().show();
  }

  protected async enterAsAdmin(client: PayingClient): Promise<void> {
    if (this.impersonatingId() !== null) return;
    this.impersonatingId.set(client.tenantId);
    this.impersonateError.set(null);
    const result = await this.impersonateService.getImpersonationLink(
      client.tenantId
    );
    this.impersonatingId.set(null);
    result.fold(
      (err) => this.impersonateError.set(err.message),
      (data) => {
        window.open(data.actionLink, '_blank', 'noopener,noreferrer');
      }
    );
  }

  protected computeStatus = computeStatus;

  protected initial(client: PayingClient): string {
    const source = client.tenantName ?? client.tenantSlug ?? '?';
    return source.trim().charAt(0).toUpperCase() || '?';
  }

  protected tierLabel = tierLabel;
  protected cycleLabel = cycleLabel;

  protected statusLabel(status: PayingClientStatus): string {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'expiring':
        return 'Por vencer';
      case 'expired':
        return 'Vencido';
    }
  }
}

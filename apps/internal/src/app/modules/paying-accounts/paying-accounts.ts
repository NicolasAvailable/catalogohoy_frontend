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
import { tierLabel } from '../shared/plan-cycle.model';
import { ClientDetailDialog } from '../paying-clients/components/client-detail-dialog/client-detail-dialog';
import {
  computeStatus,
  PayingClient,
} from '../paying-clients/paying-clients.model';
import { PayingClientsStore } from '../paying-clients/paying-clients.store';
import {
  AssignPlanDialog,
  AssignPlanPayload,
} from '../tenants/components/assign-plan-dialog/assign-plan-dialog';
import { Tenant } from '../tenants/tenants.model';
import { TenantsStore } from '../tenants/tenants.store';
import { groupByOwner, PayingAccount } from './paying-accounts.model';

@Component({
  selector: 'app-paying-accounts',
  standalone: true,
  imports: [
    IconComponent,
    FormsModule,
    ClientDetailDialog,
    AssignPlanDialog,
  ],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Clientes pagos</h1>
        <p class="text-sm text-grey-400">
          Cuentas con uno o más catálogos pagos. Click en un catálogo para
          ver su detalle, ajustar el plan o escribir por WhatsApp.
        </p>
      </header>

      <section
        class="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0"
      >
        <div
          class="flex items-center gap-2 px-3 py-2 bg-white border border-grey-50 rounded-md flex-1 max-w-md"
        >
          <ui-icon name="search" size="16" styleClass="text-grey-400" />
          <input
            type="text"
            [(ngModel)]="searchTerm"
            placeholder="Buscar por nombre o email"
            class="flex-1 outline-none text-sm text-grey-700 bg-transparent"
          />
        </div>
        <span class="text-xs text-grey-400">
          {{ filteredAccounts().length }}
          {{ filteredAccounts().length === 1 ? 'cuenta' : 'cuentas' }}
        </span>
      </section>

      @if (store.isLoading()) {
        <div class="flex items-center justify-center py-12">
          <ui-icon
            name="loader-circle"
            size="24"
            styleClass="text-grey-300 animate-spin"
          />
        </div>
      } @else if (filteredAccounts().length === 0) {
        <div
          class="flex flex-col items-center justify-center gap-2 py-12 rounded-xl border border-dashed border-grey-100 bg-white"
        >
          <ui-icon name="inbox" size="28" styleClass="text-grey-300" />
          <span class="text-sm text-grey-400">
            No hay cuentas que coincidan
          </span>
        </div>
      } @else {
        <section
          class="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-grey-50"
        >
          <table class="w-full text-sm">
            <thead class="bg-grey-25 sticky top-0">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-grey-500">
                  Cuenta
                </th>
                <th class="px-4 py-3 text-left font-semibold text-grey-500">
                  Catálogos
                </th>
                <th class="px-4 py-3 text-left font-semibold text-grey-500">
                  Plan más alto
                </th>
                <th class="px-4 py-3 text-left font-semibold text-grey-500">
                  Catálogos que paga
                </th>
              </tr>
            </thead>
            <tbody>
              @for (account of filteredAccounts(); track account.email) {
                <tr class="border-t border-grey-50">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3 min-w-0">
                      @if (account.avatarUrl) {
                        <img
                          [src]="account.avatarUrl"
                          [alt]="account.name ?? ''"
                          referrerpolicy="no-referrer"
                          class="w-9 h-9 rounded-full object-cover shrink-0 border border-grey-50"
                        />
                      } @else {
                        <div
                          class="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center shrink-0 font-semibold uppercase"
                        >
                          {{ initial(account) }}
                        </div>
                      }
                      <div class="flex flex-col min-w-0">
                        <strong
                          class="text-sm font-semibold text-grey-700 truncate"
                        >
                          {{ account.name ?? 'Sin nombre' }}
                        </strong>
                        <span class="text-xs text-grey-400 truncate">
                          {{ account.email }}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 align-middle">
                    <span
                      class="inline-flex items-center justify-center min-w-7 h-6 px-2 rounded-full bg-primary-50 text-primary-600 text-xs font-bold"
                    >
                      {{ account.catalogCount }}
                    </span>
                  </td>
                  <td class="px-4 py-3 align-middle">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase"
                      [class.bg-emerald-50]="account.highestTier === 'avanzado'"
                      [class.text-emerald-600]="
                        account.highestTier === 'avanzado'
                      "
                      [class.bg-sky-50]="account.highestTier === 'basico'"
                      [class.text-sky-600]="account.highestTier === 'basico'"
                    >
                      {{ tierLabel(account.highestTier) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1.5">
                      @for (cat of account.catalogs; track cat.tenantId) {
                        <button
                          type="button"
                          (click)="openCatalogDetail(cat)"
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-grey-50 hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer"
                          [title]="
                            (cat.tenantName ?? cat.tenantSlug ?? '?') +
                            ' · ' +
                            tierLabel(cat.tier)
                          "
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full"
                            [class.bg-emerald-500]="
                              statusOf(cat) === 'active'
                            "
                            [class.bg-amber-500]="
                              statusOf(cat) === 'expiring'
                            "
                            [class.bg-red-500]="statusOf(cat) === 'expired'"
                          ></span>
                          <span
                            class="text-xs font-semibold text-grey-700 truncate max-w-40"
                          >
                            {{ cat.tenantName ?? cat.tenantSlug ?? 'Sin nombre' }}
                          </span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    </div>

    <app-client-detail-dialog (adjustPlan)="onAdjustPlan($event)" />
    <app-assign-plan-dialog
      (assign)="onAssign($event)"
      (remove)="onRemovePlan($event)"
    />
  `,
})
export default class PayingAccounts implements OnInit {
  protected readonly store = inject(PayingClientsStore);
  private readonly tenantsStore = inject(TenantsStore);

  protected readonly searchTerm = signal('');

  private readonly detailDialog = viewChild.required(ClientDetailDialog);
  private readonly assignDialog = viewChild.required(AssignPlanDialog);

  protected readonly accounts = computed(() =>
    groupByOwner(this.store.clients())
  );

  protected readonly filteredAccounts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.accounts();
    return this.accounts().filter((a) => {
      const name = (a.name ?? '').toLowerCase();
      return name.includes(term) || a.email.toLowerCase().includes(term);
    });
  });

  ngOnInit(): void {
    if (this.store.clients().length === 0) {
      this.store.load();
    }
  }

  protected async openCatalogDetail(client: PayingClient): Promise<void> {
    await this.store.openDetail(client.tenantId);
    this.detailDialog().show();
  }

  protected onAdjustPlan(client: PayingClient): void {
    const tenant: Tenant = {
      id: client.tenantId,
      name: client.tenantName,
      slug: client.tenantSlug,
      countryCode: null,
      logo: client.tenantLogo,
      ownerName: client.ownerName,
      ownerEmail: client.ownerEmail,
      createdAt: client.startedAt,
      plan: {
        tier: client.tier,
        cycle: client.cycle,
        startedAt: client.startedAt,
        expiresAt: client.expiresAt,
        expired:
          client.daysUntilExpiry !== null && client.daysUntilExpiry < 0,
      },
    };
    this.assignDialog().show(tenant);
  }

  protected async onAssign(payload: AssignPlanPayload): Promise<void> {
    await this.tenantsStore.assignPlan(
      payload.tenantId,
      payload.tier,
      payload.cycle,
      payload.amountUsd
    );
    await this.store.load();
  }

  protected async onRemovePlan(tenantId: number): Promise<void> {
    await this.tenantsStore.removePlan(tenantId);
    await this.store.load();
  }

  protected initial(account: PayingAccount): string {
    const source = account.name ?? account.email;
    return source.trim().charAt(0).toUpperCase() || '?';
  }

  protected statusOf(client: PayingClient): ReturnType<typeof computeStatus> {
    return computeStatus(client.daysUntilExpiry);
  }

  protected tierLabel = tierLabel;
}

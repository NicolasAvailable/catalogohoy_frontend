import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
import { Component, inject, output, viewChild } from '@angular/core';
import { DialogComponent, IconComponent } from '@ui';
import {
  cycleLabel,
  tierLabel,
} from '../../../shared/plan-cycle.model';
import { PayingClient } from '../../paying-clients.model';
import { WhatsappContact } from '../../paying-clients.service';
import { PayingClientsStore } from '../../paying-clients.store';

@Component({
  selector: 'app-client-detail-dialog',
  standalone: true,
  imports: [DialogComponent, IconComponent, CurrencyPipe, DatePipe],
  template: `
    <ui-dialog
      headerTitle="Detalle del cliente"
      styleClass="!w-[44rem] !max-w-[95vw]"
    >
      @if (store.selectedClient(); as client) {
        <div class="flex flex-col gap-5">
          <!-- Client header -->
          <div class="flex items-start gap-4 pb-4 border-b border-grey-50">
            @if (client.tenantLogo) {
              <img
                [src]="client.tenantLogo"
                [alt]="client.tenantName ?? ''"
                referrerpolicy="no-referrer"
                class="w-14 h-14 rounded-xl object-cover shrink-0 border border-grey-50"
              />
            } @else {
              <div
                class="w-14 h-14 rounded-xl bg-primary-500 flex items-center justify-center shrink-0 text-white text-lg font-bold uppercase"
              >
                {{ initial(client) }}
              </div>
            }
            <div class="flex flex-col min-w-0 flex-1">
              <strong class="text-lg font-bold text-grey-700 truncate">
                {{ client.tenantName ?? 'Sin nombre' }}
              </strong>
              @if (client.tenantSlug) {
                <span class="text-xs text-grey-400 truncate">
                  {{ client.tenantSlug }}.catalogohoy.com
                </span>
              }
              <div class="flex items-center gap-2 mt-2">
                @if (client.ownerAvatarUrl) {
                  <img
                    [src]="client.ownerAvatarUrl"
                    [alt]="client.ownerName ?? ''"
                    referrerpolicy="no-referrer"
                    class="w-5 h-5 rounded-full object-cover border border-grey-50"
                  />
                } @else {
                  <ui-icon name="user" size="14" styleClass="text-grey-400" />
                }
                <span class="text-xs text-grey-500">
                  {{ client.ownerName ?? 'Sin nombre' }} ·
                  {{ client.ownerEmail ?? '—' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Active subscription summary -->
          <div class="grid grid-cols-3 gap-3">
            <div
              class="flex flex-col gap-1 p-3 rounded-lg bg-primary-50 border border-primary-100"
            >
              <span class="text-[10px] uppercase font-semibold text-grey-400">
                Plan actual
              </span>
              <strong class="text-sm font-bold text-grey-700">
                {{ tierLabel(client.tier) }}
              </strong>
              @if (client.cycle) {
                <span class="text-xs text-grey-500">
                  {{ cycleLabel(client.cycle) }}
                </span>
              }
            </div>
            <div
              class="flex flex-col gap-1 p-3 rounded-lg bg-grey-25 border border-grey-50"
            >
              <span class="text-[10px] uppercase font-semibold text-grey-400">
                Vence
              </span>
              <strong class="text-sm font-bold text-grey-700">
                @if (client.expiresAt) {
                  {{ client.expiresAt | date: 'dd/MM/yyyy' }}
                } @else {
                  —
                }
              </strong>
              @if (client.daysUntilExpiry !== null) {
                <span class="text-xs text-grey-500">
                  @if (client.daysUntilExpiry < 0) {
                    Hace {{ -client.daysUntilExpiry }}d
                  } @else {
                    En {{ client.daysUntilExpiry }}d
                  }
                </span>
              }
            </div>
            <div
              class="flex flex-col gap-1 p-3 rounded-lg bg-grey-25 border border-grey-50"
            >
              <span class="text-[10px] uppercase font-semibold text-grey-400">
                Total pagado
              </span>
              <strong class="text-sm font-bold text-grey-700">
                {{ totalPaid() | currency: 'USD' : 'symbol' : '1.0-2' }}
              </strong>
              <span class="text-xs text-grey-500">
                {{ store.history().length }}
                {{
                  store.history().length === 1
                    ? 'suscripción'
                    : 'suscripciones'
                }}
              </span>
            </div>
          </div>

          <!-- History -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-grey-700">
                Historial de suscripciones
              </h3>
              <span class="text-xs text-grey-400">
                Más recientes primero
              </span>
            </div>

            @if (store.isLoadingHistory()) {
              <div class="flex items-center justify-center py-8">
                <ui-icon
                  name="loader-circle"
                  size="20"
                  styleClass="text-grey-300 animate-spin"
                />
              </div>
            } @else if (store.history().length === 0) {
              <div
                class="flex flex-col items-center gap-2 py-8 rounded-lg border border-dashed border-grey-100"
              >
                <ui-icon name="inbox" size="24" styleClass="text-grey-300" />
                <span class="text-xs text-grey-400">
                  Sin historial de suscripciones
                </span>
              </div>
            } @else {
              <div class="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                @for (entry of store.history(); track entry.id) {
                  <div
                    class="flex items-center justify-between gap-3 p-3 rounded-lg border border-grey-50 bg-grey-25"
                  >
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        class="inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0"
                        [class.bg-emerald-50]="entry.status === 'active'"
                        [class.bg-grey-50]="entry.status === 'expired'"
                        [class.bg-red-50]="entry.status === 'cancelled'"
                      >
                        <ui-icon
                          [name]="
                            entry.status === 'active'
                              ? 'check-circle'
                              : entry.status === 'cancelled'
                              ? 'circle-x'
                              : 'clock'
                          "
                          size="14"
                          [styleClass]="
                            entry.status === 'active'
                              ? 'text-emerald-500'
                              : entry.status === 'cancelled'
                              ? 'text-red-500'
                              : 'text-grey-400'
                          "
                        />
                      </span>
                      <div class="flex flex-col min-w-0">
                        <div class="flex items-center gap-2">
                          <strong class="text-sm font-semibold text-grey-700">
                            {{ tierLabel(entry.tier) }}
                          </strong>
                          <span class="text-xs text-grey-500">
                            {{ cycleLabel(entry.cycle) }}
                          </span>
                          <span
                            class="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                            [class.bg-emerald-50]="entry.status === 'active'"
                            [class.text-emerald-600]="entry.status === 'active'"
                            [class.bg-grey-50]="entry.status === 'expired'"
                            [class.text-grey-500]="entry.status === 'expired'"
                            [class.bg-red-50]="entry.status === 'cancelled'"
                            [class.text-red-600]="entry.status === 'cancelled'"
                          >
                            {{ statusLabel(entry.status) }}
                          </span>
                        </div>
                        <span class="text-xs text-grey-400">
                          {{ entry.startedAt | date: 'dd/MM/yyyy' }}
                          @if (entry.expiresAt) {
                            → {{ entry.expiresAt | date: 'dd/MM/yyyy' }}
                          }
                        </span>
                      </div>
                    </div>
                    @if (entry.amountUsd !== null) {
                      <strong class="text-sm font-bold text-grey-700 shrink-0">
                        {{
                          entry.amountUsd
                            | currency: 'USD' : 'symbol' : '1.0-2'
                        }}
                      </strong>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-grey-50 flex-wrap">
            @for (contact of store.whatsappNumbers(); track contact.number) {
              <a
                [href]="buildWhatsappUrl(client, contact)"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer"
                [title]="contact.name ? contact.name + ' · ' + contact.number : contact.number"
              >
                <ui-icon name="message-circle" size="14" styleClass="text-white" />
                @if (store.whatsappNumbers().length > 1 && contact.name) {
                  WhatsApp · {{ contact.name }}
                } @else {
                  Enviar WhatsApp
                }
              </a>
            }
            <button
              type="button"
              (click)="onAdjustPlan(client)"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer"
            >
              <ui-icon name="settings-2" size="14" styleClass="text-white" />
              Ajustar plan
            </button>
            <button
              type="button"
              (click)="hide()"
              class="px-4 py-2 rounded-md text-sm font-semibold text-grey-500 hover:bg-grey-50 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      }
    </ui-dialog>
  `,
})
export class ClientDetailDialog {
  public readonly adjustPlan = output<PayingClient>();

  protected readonly store = inject(PayingClientsStore);
  private readonly dialog = viewChild.required(DialogComponent);

  public show(): void {
    this.dialog().show();
  }

  public hide(): void {
    this.dialog().hide();
    this.store.closeDetail();
  }

  protected onAdjustPlan(client: PayingClient): void {
    this.dialog().hide();
    this.adjustPlan.emit(client);
  }

  /** Builds a wa.me deeplink with an expiry-aware default message. The phone
   *  number is stripped of every non-digit (wa.me requires E.164 digits only). */
  protected buildWhatsappUrl(
    client: PayingClient,
    contact: WhatsappContact
  ): string {
    const digits = contact.number.replace(/\D+/g, '');
    const message = this.buildWhatsappMessage(client);
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  private buildWhatsappMessage(client: PayingClient): string {
    const greeting = client.ownerName?.trim()
      ? `Hola ${client.ownerName.trim()}! 👋`
      : 'Hola! 👋';
    const tenant = client.tenantName?.trim() || 'tu catálogo';
    const tier = tierLabel(client.tier);
    const days = client.daysUntilExpiry;
    const expiry = client.expiresAt
      ? formatDate(client.expiresAt, 'dd/MM/yyyy', 'es-ES')
      : null;

    if (days !== null && days < 0 && expiry) {
      return `${greeting} Te escribo de CatalogoHoy. Notamos que tu plan ${tier} de "${tenant}" venció el ${expiry}. ¿Te ayudo a reactivarlo?`;
    }
    if (days !== null && days <= 7 && expiry) {
      return `${greeting} Te escribo de CatalogoHoy. Tu plan ${tier} de "${tenant}" vence el ${expiry}. ¿Te ayudo a renovarlo?`;
    }
    if (expiry) {
      return `${greeting} Te escribo de CatalogoHoy sobre tu plan ${tier} de "${tenant}" (vence el ${expiry}).`;
    }
    return `${greeting} Te escribo de CatalogoHoy sobre tu plan ${tier} de "${tenant}".`;
  }

  protected initial(client: PayingClient): string {
    const source = client.tenantName ?? client.tenantSlug ?? '?';
    return source.trim().charAt(0).toUpperCase() || '?';
  }

  protected totalPaid(): number {
    return this.store
      .history()
      .reduce((sum, e) => sum + (e.amountUsd ?? 0), 0);
  }

  protected tierLabel = tierLabel;
  protected cycleLabel = cycleLabel;

  protected statusLabel(status: 'active' | 'expired' | 'cancelled'): string {
    switch (status) {
      case 'active':
        return 'Activa';
      case 'expired':
        return 'Vencida';
      case 'cancelled':
        return 'Cancelada';
    }
  }
}

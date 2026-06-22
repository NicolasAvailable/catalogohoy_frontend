import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import {
  describeVariables,
  statusLabel,
  templateLabel,
  WhatsappLog,
  WhatsappLogStatus,
} from './whatsapp-logs.model';
import { WhatsappLogsStore } from './whatsapp-logs.store';

type StatusFilter = 'all' | WhatsappLogStatus;

@Component({
  selector: 'app-whatsapp-logs',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe],
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
}

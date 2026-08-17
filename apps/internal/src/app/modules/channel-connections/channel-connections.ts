import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import {
  channelIcon,
  channelLabel,
  ChannelType,
} from './channel-connections.model';
import { ChannelConnectionsStore } from './channel-connections.store';

type ChannelFilter = 'all' | ChannelType;

@Component({
  selector: 'app-channel-connections',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Canales conectados</h1>
        <p class="text-sm text-grey-400">
          Cuentas que los catálogos conectaron a su bandeja: WhatsApp Business,
          Instagram y TikTok. {{ store.counts().tenants }} catálogo(s) con al
          menos un canal activo.
        </p>
      </header>

      <section class="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50"
          >
            <ui-icon name="message-circle" size="18" styleClass="text-emerald-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">WhatsApp</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().whatsapp }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-fuchsia-50"
          >
            <ui-icon name="instagram" size="18" styleClass="text-fuchsia-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Instagram</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().instagram }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-grey-100"
          >
            <ui-icon name="music" size="18" styleClass="text-grey-600" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">TikTok</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().tiktok }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50"
          >
            <ui-icon name="store" size="18" styleClass="text-primary-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Catálogos</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().tenants }}
            </strong>
          </div>
        </article>
      </section>

      <section class="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
        <div
          class="flex items-center gap-2 px-3 py-2 bg-white border border-grey-50 rounded-md flex-1 max-w-md"
        >
          <ui-icon name="search" size="16" styleClass="text-grey-400" />
          <input
            type="text"
            placeholder="Buscar por catálogo o cuenta..."
            class="flex-1 outline-none text-sm text-grey-700 placeholder:text-grey-300 bg-transparent"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
        </div>
        <div
          class="flex items-center gap-1 bg-white p-1 rounded-md border border-grey-50"
        >
          @for (filter of channelFilters; track filter.value) {
            <button
              type="button"
              (click)="channelFilter.set(filter.value)"
              class="px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
              [class.bg-primary-500]="channelFilter() === filter.value"
              [class.text-white]="channelFilter() === filter.value"
              [class.text-grey-500]="channelFilter() !== filter.value"
              [class.hover:bg-grey-50]="channelFilter() !== filter.value"
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
                  Catálogo
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Canal
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Cuenta
                </th>
                <th
                  class="sticky top-0 z-10 text-right text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Conectado
                </th>
              </tr>
            </thead>
            <tbody>
              @if (store.isLoading()) {
                <tr>
                  <td colspan="4" class="px-4 py-12 text-center">
                    <div class="flex flex-col items-center gap-2">
                      <ui-icon
                        name="loader-circle"
                        size="24"
                        styleClass="text-grey-300 animate-spin"
                      />
                      <p class="text-sm text-grey-400">Cargando conexiones...</p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (c of filteredConnections(); track $index) {
                  <tr class="hover:bg-grey-25 transition-colors">
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-col min-w-0">
                        <span class="text-grey-700 truncate">
                          {{ c.tenantName ?? '—' }}
                        </span>
                        @if (c.tenantSlug) {
                          <span class="text-xs text-grey-400 truncate">
                            {{ c.tenantSlug }}
                          </span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <span
                        class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold"
                        [class.bg-emerald-50]="c.channel === 'whatsapp'"
                        [class.text-emerald-600]="c.channel === 'whatsapp'"
                        [class.bg-fuchsia-50]="c.channel === 'instagram'"
                        [class.text-fuchsia-600]="c.channel === 'instagram'"
                        [class.bg-grey-100]="c.channel === 'tiktok'"
                        [class.text-grey-700]="c.channel === 'tiktok'"
                      >
                        <ui-icon [name]="channelIcon(c.channel)" size="13" />
                        {{ channelLabel(c.channel) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-col min-w-0">
                        <span class="text-grey-700 truncate">
                          {{ c.identity ?? '—' }}
                        </span>
                        @if (c.displayName && c.displayName !== c.identity) {
                          <span class="text-xs text-grey-400 truncate">
                            {{ c.displayName }}
                          </span>
                        }
                      </div>
                    </td>
                    <td
                      class="px-4 py-3 text-right text-grey-500 border-b border-grey-50 whitespace-nowrap"
                    >
                      {{ c.connectedAt | date: 'dd/MM/yyyy HH:mm' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="px-4 py-12 text-center">
                      <div class="flex flex-col items-center gap-2">
                        <ui-icon
                          name="link-2"
                          size="28"
                          styleClass="text-grey-300"
                        />
                        <p class="text-sm text-grey-400">
                          No hay canales conectados que coincidan con el filtro.
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
export class ChannelConnections implements OnInit {
  protected readonly store = inject(ChannelConnectionsStore);

  protected readonly searchTerm = signal('');
  protected readonly channelFilter = signal<ChannelFilter>('all');

  protected readonly channelFilters: { value: ChannelFilter; label: string }[] =
    [
      { value: 'all', label: 'Todos' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'tiktok', label: 'TikTok' },
    ];

  protected readonly filteredConnections = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const channel = this.channelFilter();
    return this.store.connections().filter((c) => {
      const matchesTerm =
        !term ||
        (c.tenantName ?? '').toLowerCase().includes(term) ||
        (c.tenantSlug ?? '').toLowerCase().includes(term) ||
        (c.identity ?? '').toLowerCase().includes(term) ||
        (c.displayName ?? '').toLowerCase().includes(term);
      const matchesChannel = channel === 'all' || c.channel === channel;
      return matchesTerm && matchesChannel;
    });
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected channelLabel = channelLabel;
  protected channelIcon = channelIcon;
}

import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import {
  catalogsLabel,
  EnterpriseLead,
  EnterpriseLeadStatus,
  LEAD_STATUS_OPTIONS,
  needsLabel,
  rangeLabel,
  statusLabel,
  teamLabel,
} from './enterprise-leads.model';
import { EnterpriseLeadsStore } from './enterprise-leads.store';

type QualifiedFilter = 'all' | 'qualified' | 'not_qualified';

@Component({
  selector: 'app-enterprise-leads',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Leads Enterprise</h1>
        <p class="text-sm text-grey-400">
          Interesados que completaron el funnel de "Contactar ventas"
          (landing y admin), con su calificación y respuestas.
        </p>
      </header>

      <section class="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-grey-50"
          >
            <ui-icon name="building-2" size="18" styleClass="text-grey-500" />
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
            <ui-icon name="badge-check" size="18" styleClass="text-emerald-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Calificados</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().qualified }}
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
            <span class="text-xs text-grey-400">Sin contactar</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().pending }}
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50"
          >
            <ui-icon name="trophy" size="18" styleClass="text-primary-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Ganados</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ store.counts().won }}
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
            placeholder="Buscar por negocio, contacto o email..."
            class="flex-1 outline-none text-sm text-grey-700 placeholder:text-grey-300 bg-transparent"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
        </div>
        <div
          class="flex items-center gap-1 bg-white p-1 rounded-md border border-grey-50"
        >
          @for (filter of qualifiedFilters; track filter.value) {
            <button
              type="button"
              (click)="qualifiedFilter.set(filter.value)"
              class="px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
              [class.bg-primary-500]="qualifiedFilter() === filter.value"
              [class.text-white]="qualifiedFilter() === filter.value"
              [class.text-grey-500]="qualifiedFilter() !== filter.value"
              [class.hover:bg-grey-50]="qualifiedFilter() !== filter.value"
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
                  Lead
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Contacto
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Score
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
                      <p class="text-sm text-grey-400">Cargando leads...</p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (lead of filteredLeads(); track lead.id) {
                  <tr
                    class="hover:bg-grey-25 transition-colors align-top cursor-pointer"
                    (click)="toggle(lead)"
                  >
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex items-center gap-2 min-w-0">
                        <ui-icon
                          [name]="
                            expandedId() === lead.id
                              ? 'chevron-down'
                              : 'chevron-right'
                          "
                          size="16"
                          styleClass="text-grey-400 shrink-0"
                        />
                        <div class="flex flex-col min-w-0">
                          <span class="font-medium text-grey-700 truncate">
                            {{ lead.businessName }}
                          </span>
                          <span class="text-xs text-grey-400 truncate">
                            {{ lead.country || '—' }} ·
                            {{
                              lead.source === 'admin'
                                ? 'admin (' + (lead.tenantSlug ?? '?') + ')'
                                : 'landing'
                            }}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-col min-w-0">
                        <span class="text-grey-700 truncate">{{ lead.name }}</span>
                        <span class="text-xs text-grey-400 truncate">
                          {{ lead.email }}
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <span
                        class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                        [class.bg-emerald-50]="lead.qualified"
                        [class.text-emerald-600]="lead.qualified"
                        [class.bg-grey-50]="!lead.qualified"
                        [class.text-grey-500]="!lead.qualified"
                      >
                        <ui-icon
                          [name]="lead.qualified ? 'badge-check' : 'minus'"
                          size="12"
                        />
                        {{ lead.score }} ·
                        {{ lead.qualified ? 'Calificado' : 'No calificado' }}
                      </span>
                    </td>
                    <td
                      class="px-4 py-3 border-b border-grey-50"
                      (click)="$event.stopPropagation()"
                    >
                      <select
                        class="text-xs font-semibold rounded-md border border-grey-100 bg-white px-2 py-1.5 text-grey-700 cursor-pointer outline-none"
                        [ngModel]="lead.status"
                        (ngModelChange)="store.updateStatus(lead.id, $event)"
                      >
                        @for (option of statusOptions; track option.value) {
                          <option [value]="option.value">{{ option.label }}</option>
                        }
                      </select>
                    </td>
                    <td
                      class="px-4 py-3 text-right text-grey-500 border-b border-grey-50 whitespace-nowrap"
                    >
                      {{ lead.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                    </td>
                  </tr>
                  @if (expandedId() === lead.id) {
                    <tr class="bg-grey-25">
                      <td colspan="5" class="px-4 py-4 border-b border-grey-50">
                        <div
                          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1.5 pl-6 max-w-4xl"
                        >
                          <div class="flex gap-2 text-sm">
                            <span class="text-grey-400 shrink-0">Productos:</span>
                            <span class="text-grey-700">
                              {{ rangeLabel(lead.productsRange) }}
                            </span>
                          </div>
                          <div class="flex gap-2 text-sm">
                            <span class="text-grey-400 shrink-0">Pedidos/mes:</span>
                            <span class="text-grey-700">
                              {{ rangeLabel(lead.ordersRange) }}
                            </span>
                          </div>
                          <div class="flex gap-2 text-sm">
                            <span class="text-grey-400 shrink-0">Catálogos:</span>
                            <span class="text-grey-700">
                              {{ catalogsLabel(lead.catalogsNeeded) }}
                            </span>
                          </div>
                          <div class="flex gap-2 text-sm">
                            <span class="text-grey-400 shrink-0">Equipo:</span>
                            <span class="text-grey-700">
                              {{ teamLabel(lead.teamSize) }}
                            </span>
                          </div>
                          <div class="flex gap-2 text-sm sm:col-span-2">
                            <span class="text-grey-400 shrink-0">Necesidades:</span>
                            <span class="text-grey-700">
                              {{ needsLabel(lead.needs) }}
                            </span>
                          </div>
                          @if (lead.phone) {
                            <div class="flex items-center gap-2 text-sm">
                              <span class="text-grey-400 shrink-0">WhatsApp:</span>
                              <a
                                [href]="'https://wa.me/' + waNumber(lead.phone)"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-emerald-600 font-medium hover:underline"
                                (click)="$event.stopPropagation()"
                              >
                                {{ lead.phone }}
                              </a>
                            </div>
                          }
                          <div class="flex items-center gap-2 text-sm">
                            <span class="text-grey-400 shrink-0">Email:</span>
                            <a
                              [href]="'mailto:' + lead.email"
                              class="text-primary-500 font-medium hover:underline"
                              (click)="$event.stopPropagation()"
                            >
                              {{ lead.email }}
                            </a>
                          </div>
                          @if (lead.website) {
                            <div class="flex gap-2 text-sm">
                              <span class="text-grey-400 shrink-0">Web:</span>
                              <span class="text-grey-700 break-all">
                                {{ lead.website }}
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
                          name="building-2"
                          size="28"
                          styleClass="text-grey-300"
                        />
                        <p class="text-sm text-grey-400">
                          Todavía no hay leads que coincidan con el filtro.
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
export class EnterpriseLeads implements OnInit {
  protected readonly store = inject(EnterpriseLeadsStore);

  protected readonly searchTerm = signal('');
  protected readonly qualifiedFilter = signal<QualifiedFilter>('all');
  protected readonly expandedId = signal<number | null>(null);

  protected readonly statusOptions = LEAD_STATUS_OPTIONS;

  protected readonly qualifiedFilters: {
    value: QualifiedFilter;
    label: string;
  }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'qualified', label: 'Calificados' },
    { value: 'not_qualified', label: 'No calificados' },
  ];

  protected readonly filteredLeads = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.qualifiedFilter();
    return this.store.leads().filter((lead) => {
      const matchesTerm =
        !term ||
        lead.businessName.toLowerCase().includes(term) ||
        lead.name.toLowerCase().includes(term) ||
        lead.email.toLowerCase().includes(term) ||
        (lead.country ?? '').toLowerCase().includes(term);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'qualified' ? lead.qualified : !lead.qualified);
      return matchesTerm && matchesFilter;
    });
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected toggle(lead: EnterpriseLead): void {
    this.expandedId.update((id) => (id === lead.id ? null : lead.id));
  }

  protected waNumber(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  protected rangeLabel = rangeLabel;
  protected catalogsLabel = catalogsLabel;
  protected teamLabel = teamLabel;
  protected needsLabel = needsLabel;
  protected statusLabel = statusLabel;
}

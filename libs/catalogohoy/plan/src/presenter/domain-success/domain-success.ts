import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { IconComponent } from '@ui';

/** Segundos antes de llevar a Editar catálogo (ahí se ve la sincronización). */
const REDIRECT_MS = 5000;
/** Ruta de Editar catálogo con la tarjeta del dominio a la vista. */
export const CATALOG_DOMAIN_URL = '/admin/catalog/edit?section=domain-card';

/**
 * Pantalla de éxito al volver de pagar un dominio (Stripe → success_url):
 * check grande, "¡El dominio es tuyo!" y a los 5 s lleva a Editar catálogo,
 * donde la tarjeta del dominio muestra cómo se va sincronizando.
 */
@Component({
  selector: 'lib-domain-success',
  imports: [IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex-1 flex flex-col min-h-0' },
  template: `
    <div class="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto" data-testid="domain-success">
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-green-100 opacity-40 blur-3xl"></div>
      </div>

      <div class="relative flex flex-col items-center text-center max-w-lg w-full gap-6 py-12">
        <div class="relative">
          <div class="absolute inset-0 rounded-full bg-green-200 opacity-40 scale-150 blur-xl"></div>
          <div class="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center shadow-sm">
            <ui-icon name="sparkles" styleClass="size-4 text-yellow-500" />
          </div>
          <div class="absolute -bottom-3 -left-5 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shadow-sm">
            <ui-icon name="globe" styleClass="size-3 text-primary-500" />
          </div>
          <div class="relative w-32 h-32 rounded-full bg-linear-to-br from-green-400 to-green-500 flex items-center justify-center shadow-xl shadow-green-200">
            <ui-icon name="check" styleClass="size-16 text-white" />
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <h1 class="text-4xl sm:text-5xl font-bold text-grey-800 leading-tight">
            {{ '¡El dominio es tuyo!' | transloco }}
          </h1>
          @if (domain(); as d) {
            <p class="text-xl font-semibold text-primary-600 break-all" data-testid="domain-success-name">{{ d }}</p>
          }
          <p class="text-lg text-grey-500 leading-relaxed">
            {{ 'Lo estamos conectando con tu catálogo' | transloco }}@if (catalogName(); as n) { <span class="font-semibold text-grey-700">{{ n }}</span>}.
          </p>
          <p class="text-sm text-grey-300 leading-relaxed max-w-sm mx-auto">
            {{ 'Te llevamos a Editar catálogo para que veas cómo se sincroniza…' | transloco }}
          </p>
        </div>

        <button type="button" (click)="goToCatalog()" data-testid="domain-success-catalog"
                class="w-full max-w-sm flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold text-base transition-colors cursor-pointer shadow-lg shadow-primary-200">
          <ui-icon name="palette" styleClass="size-5" />
          {{ 'Ir a Editar catálogo' | transloco }}
        </button>
      </div>
    </div>
  `,
})
export class DomainSuccess implements OnInit, OnDestroy {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  public readonly domain = signal<string | null>(null);
  public readonly catalogName = computed(() => this.tenantStore.tenant().tenantName);
  private timer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    this.timer = setTimeout(() => this.goToCatalog(), REDIRECT_MS);
    // Nombre del dominio recién comprado (también empuja la compra en el backend).
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    const { data } = await this.client.functions.invoke('domains', { body: { tenantId, action: 'status' } });
    const latest = (data as { domains?: { domain: string }[] } | null)?.domains?.[0];
    if (latest) this.domain.set(latest.domain);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  /** Recarga completa para que el editor tome el estado nuevo de la tienda. */
  public goToCatalog(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try { sessionStorage.setItem('ch_open_domain_card', '1'); } catch { /* noop */ }
    window.location.assign(CATALOG_DOMAIN_URL);
  }
}

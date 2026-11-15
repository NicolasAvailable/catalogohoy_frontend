import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent } from '@ui';

interface SearchResult {
  domain: string;
  tld: string;
  available: boolean;
  sellable: boolean;
  reason: 'taken' | 'premium' | 'too_expensive' | 'no_price' | null;
  priceCents: number | null;
}

interface OwnedDomain {
  id: string;
  domain: string;
  status: string;
  priceCents: number;
  autoRenew: boolean;
  expiresAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

const IN_PROGRESS = ['paid', 'registering', 'registered', 'connecting'];
const POLL_MS = 8000;

/**
 * Perfil → pestaña "Dominio": la tienda busca y compra su dominio propio
 * (registrado en Namecheap a nombre de CatalogoHoy) y queda conectado solo.
 * Toda la lógica y el precio viven en la edge `domains`; aquí solo se muestra.
 */
@Component({
  selector: 'lib-domain-shop',
  imports: [DatePipe, FormsModule, TranslocoPipe, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4 sm:gap-6">
      <header>
        <h2 class="text-2xl font-bold text-grey-800 mb-1">{{ 'Dominio propio' | transloco }}</h2>
        <p class="text-sm sm:text-base text-grey-400">
          {{ 'Compra tu dominio (por ejemplo, mitienda.com) y tu catálogo queda funcionando ahí, sin configurar nada.' | transloco }}
        </p>
      </header>

      @if (forbidden()) {
        <div class="bg-white border border-grey-100 rounded-xl p-6 text-grey-600">
          {{ 'Solo el dueño o un administrador de la tienda puede comprar un dominio.' | transloco }}
        </div>
      } @else {
        <!-- Dominio actual / en proceso -->
        @for (d of owned(); track d.id) {
          <div class="bg-white border border-grey-100 rounded-xl shadow-sm p-4 sm:p-6 flex flex-col gap-3" data-testid="domain-owned">
            <div class="flex items-center gap-2">
              <ui-icon name="globe" styleClass="size-5 text-primary-600 shrink-0" />
              <span class="text-lg font-semibold text-grey-800 break-all">{{ d.domain }}</span>
            </div>

            @if (isInProgress(d)) {
              <div class="flex items-center gap-2 text-sm text-amber-700">
                <ui-icon name="loader-circle" styleClass="size-4 animate-spin shrink-0" />
                <span>{{ progressLabel(d.status) | transloco }}</span>
              </div>
              <p class="text-xs text-grey-400">
                {{ 'Suele tardar unos minutos. Puedes cerrar esta página: te avisamos cuando esté listo.' | transloco }}
              </p>
            } @else if (d.status === 'active') {
              <div class="flex items-center gap-2 text-sm text-green-700">
                <ui-icon name="circle-check" styleClass="size-4 shrink-0" />
                <span>{{ 'Activo: tu catálogo ya abre en este dominio.' | transloco }}</span>
              </div>
              <a [href]="'https://' + d.domain" target="_blank" rel="noopener" class="self-start text-sm font-semibold text-primary-600 hover:underline">
                {{ 'Abrir' | transloco }} {{ d.domain }}
              </a>
              <p class="text-xs text-grey-500">
                @if (d.autoRenew) {
                  {{ 'Se renueva cada año por' | transloco }} {{ money(d.priceCents) }}
                } @else {
                  {{ 'No se renovará.' | transloco }}
                }
                @if (d.expiresAt) {
                  · {{ 'Vence' | transloco }} {{ d.expiresAt | date: 'dd/MM/yyyy' }}
                }
              </p>
              @if (d.autoRenew) {
                @if (confirmCancel() === d.id) {
                  <div class="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <span class="text-sm text-grey-600">{{ 'Al vencer, tu catálogo vuelve a tu dirección de CatalogoHoy. ¿Seguro?' | transloco }}</span>
                    <ui-button label="Sí, no renovar" severity="danger" size="small" [fluid]="false" [isLoading]="busy()" (click)="cancelRenewal(d.id)" />
                    <ui-button label="Volver" variant="text" size="small" [fluid]="false" (click)="confirmCancel.set(null)" />
                  </div>
                } @else {
                  <button type="button" class="self-start text-xs text-grey-400 hover:underline cursor-pointer" (click)="confirmCancel.set(d.id)">
                    {{ 'Cancelar renovación' | transloco }}
                  </button>
                }
              }
            } @else if (d.status === 'canceled') {
              <p class="text-sm text-grey-600">
                {{ 'Renovación cancelada.' | transloco }}
                @if (d.expiresAt) { {{ 'Funciona hasta el' | transloco }} {{ d.expiresAt | date: 'dd/MM/yyyy' }}. }
              </p>
            } @else if (d.status === 'refunded') {
              <p class="text-sm text-grey-600">
                {{ 'No pudimos registrar este dominio, así que te devolvimos el pago completo.' | transloco }}
              </p>
            }
          </div>
        }

        <!-- Buscador -->
        @if (canBuy()) {
          <div class="bg-white border border-grey-100 rounded-xl shadow-sm p-4 sm:p-6 flex flex-col gap-4">
            <form class="flex flex-col sm:flex-row gap-2" (ngSubmit)="search()">
              <input
                type="text"
                name="domainQuery"
                maxlength="63"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                class="flex-1 border border-grey-200 rounded-lg px-3 py-2 text-base bg-white text-grey-800"
                [placeholder]="'Ej. mitienda' | transloco"
                [ngModel]="query()"
                (ngModelChange)="query.set($event)"
                data-testid="domain-search-input"
              />
              <ui-button type="submit" label="Buscar" icon="search" [fluid]="false" [isLoading]="searching()" [disabled]="!query().trim()" (click)="search()" />
            </form>

            @if (results().length) {
              <ul class="flex flex-col divide-y divide-grey-100" data-testid="domain-results">
                @for (r of results(); track r.domain) {
                  <li class="flex items-center justify-between gap-3 py-3">
                    <div class="flex flex-col min-w-0">
                      <span class="font-semibold text-grey-800 break-all" [class.text-grey-400]="!r.sellable">{{ r.domain }}</span>
                      @if (!r.sellable) {
                        <span class="text-xs text-grey-400">{{ reasonLabel(r) | transloco }}</span>
                      }
                    </div>
                    @if (r.sellable && r.priceCents) {
                      <div class="flex items-center gap-3 shrink-0">
                        <span class="text-sm font-semibold text-grey-700 whitespace-nowrap">{{ money(r.priceCents) }}<span class="font-normal text-grey-400">/{{ 'año' | transloco }}</span></span>
                        <ui-button label="Comprar" size="small" [fluid]="false" [isLoading]="buying() === r.domain" [disabled]="!!buying()" (click)="buy(r)" />
                      </div>
                    }
                  </li>
                }
              </ul>
              <p class="text-xs text-grey-400">
                {{ 'Precio en USD por año. El dominio se registra a nombre de CatalogoHoy y queda conectado a tu catálogo automáticamente. No es reembolsable después de registrado.' | transloco }}
              </p>
            }
          </div>
        }
      }
    </div>
  `,
})
export class DomainShopComponent implements OnInit {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  public readonly forbidden = signal(false);
  public readonly query = signal('');
  public readonly searching = signal(false);
  public readonly results = signal<SearchResult[]>([]);
  public readonly owned = signal<OwnedDomain[]>([]);
  public readonly buying = signal<string | null>(null);
  public readonly busy = signal(false);
  public readonly confirmCancel = signal<string | null>(null);

  /** Se puede comprar si no hay un dominio activo o en proceso. */
  public readonly canBuy = computed(() =>
    !this.owned().some((d) => d.status === 'active' || IN_PROGRESS.includes(d.status))
  );

  private tenantId: number | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    this.destroyRef.onDestroy(() => this.stopPolling());
    this.tenantId = await this.tenantStore.getTenantIdAsync();
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('domain_session')) {
      this.toast.success('¡Pago recibido! Estamos registrando y conectando tu dominio.');
      this.clearReturnParams();
    } else if (qp.get('domain') === 'cancel') {
      this.clearReturnParams();
    }
    await this.loadStatus();
  }

  private clearReturnParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { domain_session: null, domain: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async call<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null; status?: number }> {
    const { data, error } = await this.client.functions.invoke('domains', { body: { tenantId: this.tenantId, ...body } });
    if (error) {
      // FunctionsHttpError: el cuerpo trae { error } con el mensaje en español.
      let msg = 'Algo salió mal. Intenta de nuevo.';
      let status: number | undefined;
      try {
        const ctx = (error as { context?: Response }).context;
        status = ctx?.status;
        const j = await ctx?.json();
        if (j?.error) msg = j.error;
      } catch { /* noop */ }
      return { data: null, error: msg, status };
    }
    return { data: data as T, error: null };
  }

  private async loadStatus(): Promise<void> {
    if (!this.tenantId) return;
    const { data, error, status } = await this.call<{ domains: OwnedDomain[] }>({ action: 'status' });
    if (error) {
      if (status === 403) this.forbidden.set(true);
      return;
    }
    this.owned.set(data?.domains ?? []);
    this.schedulePoll();
  }

  private schedulePoll(): void {
    this.stopPolling();
    if (this.owned().some((d) => IN_PROGRESS.includes(d.status))) {
      this.pollTimer = setTimeout(() => this.loadStatus(), POLL_MS);
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  public async search(): Promise<void> {
    const q = this.query().trim();
    if (!q || this.searching()) return;
    this.searching.set(true);
    const { data, error } = await this.call<{ results: SearchResult[] }>({ action: 'search', query: q });
    this.searching.set(false);
    if (error) {
      this.toast.error(new Exception(error));
      return;
    }
    this.results.set(data?.results ?? []);
  }

  public async buy(r: SearchResult): Promise<void> {
    if (this.buying()) return;
    this.buying.set(r.domain);
    const returnUrl = `${window.location.origin}${window.location.pathname}?tab=domain`;
    const { data, error } = await this.call<{ url: string }>({ action: 'checkout', domain: r.domain, returnUrl });
    if (error || !data?.url) {
      this.buying.set(null);
      this.toast.error(new Exception(error ?? 'No pudimos iniciar el pago.'));
      return;
    }
    window.location.href = data.url;
  }

  public async cancelRenewal(id: string): Promise<void> {
    this.busy.set(true);
    const { error } = await this.call({ action: 'cancel', id });
    this.busy.set(false);
    this.confirmCancel.set(null);
    if (error) {
      this.toast.error(new Exception(error));
      return;
    }
    this.toast.success('Listo. Tu dominio no se renovará.');
    await this.loadStatus();
  }

  public isInProgress(d: OwnedDomain): boolean {
    return IN_PROGRESS.includes(d.status);
  }

  public progressLabel(status: string): string {
    switch (status) {
      case 'paid':
      case 'registering':
        return 'Registrando tu dominio…';
      case 'registered':
        return 'Configurando el dominio…';
      default:
        return 'Conectando con tu catálogo…';
    }
  }

  public reasonLabel(r: SearchResult): string {
    switch (r.reason) {
      case 'taken':
        return 'No disponible';
      case 'premium':
      case 'too_expensive':
        return 'Dominio premium, no disponible aquí';
      default:
        return 'No disponible por ahora';
    }
  }

  public money(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { getNativeSlug, isNativeApp, SupabaseClientProvider } from '@catalogohoy/core';
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
  firstYearPriceCents: number | null;
  /** Montos en unidades menores de la moneda de la tienda (lo que cobra Stripe). */
  localPrice?: number | null;
  localFirstYearPrice?: number | null;
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

/** Nombre del catálogo -> etiqueta de dominio: sin acentos, espacios ni signos. */
function toDomainLabel(raw: string | null | undefined): string {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

const IN_PROGRESS = ['paid', 'registering', 'registered', 'connecting'];
const POLL_MS = 8000;
/** Espera tras la última tecla antes de consultar disponibilidad. */
const SEARCH_DEBOUNCE_MS = 2000;

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
      @if (!embedded()) {
        <header>
          <h2 class="text-2xl font-bold text-grey-800 mb-1">{{ 'Dominio propio' | transloco }}</h2>
          <p class="text-sm sm:text-base text-grey-400">
            {{ 'Compra tu dominio (por ejemplo, mitienda.com) y tu catálogo queda funcionando ahí, sin configurar nada.' | transloco }}
          </p>
        </header>
      }

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
          <div class="flex flex-col gap-4" [class]="embedded() ? '' : 'bg-white border border-grey-100 rounded-xl shadow-sm p-4 sm:p-6'">
            @if (embedded() && results().length && suggestedQuery()) {
              <p class="text-sm text-grey-600">{{ 'Estos dominios están disponibles para tu catálogo:' | transloco }}</p>
            }
            <form class="flex flex-row items-center gap-2" (ngSubmit)="search()">
              <input
                type="text"
                name="domainQuery"
                maxlength="63"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                class="flex-1 min-w-0 border border-grey-200 rounded-lg px-3 py-2 text-base bg-white text-grey-800"
                [placeholder]="'Ej. mitienda' | transloco"
                [ngModel]="query()"
                (ngModelChange)="onQueryChange($event)"
                data-testid="domain-search-input"
              />
              <ui-button class="shrink-0" type="submit" icon="search" [attr.aria-label]="'Buscar' | transloco" [fluid]="false" [isLoading]="searching()" [disabled]="!query().trim()" (click)="search()" />
            </form>

            @if (searching()) {
              <!-- Esqueleto mientras se consulta la disponibilidad -->
              <ul class="flex flex-col divide-y divide-grey-100" data-testid="domain-skeleton" aria-busy="true">
                @for (i of skeletonRows; track i) {
                  <li class="flex items-center justify-between gap-3 py-3 animate-pulse">
                    <div class="h-4 rounded bg-grey-100" [style.width.%]="35 + (i % 3) * 12"></div>
                    <div class="flex items-center gap-3 shrink-0">
                      <div class="h-4 w-20 rounded bg-grey-100"></div>
                      <div class="h-8 w-20 rounded-lg bg-grey-100"></div>
                    </div>
                  </li>
                }
              </ul>
            } @else if (results().length) {
              <ul class="flex flex-col divide-y divide-grey-100" data-testid="domain-results">
                @for (r of results(); track r.domain) {
                  <!-- Nombre arriba a lo ancho; precio debajo (no le roba espacio al nombre). -->
                  <li class="flex items-center justify-between gap-3 py-3">
                    <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span class="font-semibold text-grey-800 break-all" [class.text-grey-400]="!r.sellable">{{ r.domain }}</span>
                      @if (!r.sellable) {
                        <span class="text-xs text-grey-400">{{ reasonLabel(r) | transloco }}</span>
                      } @else if (r.priceCents) {
                        <span class="text-sm leading-tight">
                          <span class="font-semibold text-grey-700">{{ price(r.localFirstYearPrice, firstYear(r)) }}</span>
                          <span class="text-grey-400"> {{ (hasIntro(r) ? 'el 1er año' : '/año') | transloco }}</span>
                          @if (hasIntro(r)) {
                            <span class="text-xs text-grey-400"> · {{ 'luego' | transloco }} {{ price(r.localPrice, r.priceCents) }}/{{ 'año' | transloco }}</span>
                          }
                        </span>
                      }
                    </div>
                    @if (r.sellable && r.priceCents) {
                      <ui-button class="shrink-0" label="Comprar" size="small" [fluid]="false" [isLoading]="buying() === r.domain" [disabled]="!!buying()" (click)="buy(r)" />
                    }
                  </li>
                }
              </ul>
              <p class="text-xs text-grey-400">
                {{ 'Precios en' | transloco }} {{ currency().toUpperCase() }}.
                {{ 'El dominio se registra a nombre de CatalogoHoy y queda conectado a tu catálogo automáticamente. No es reembolsable después de registrado.' | transloco }}
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

  /** Nombre del catálogo: si viene, se buscan dominios con ese nombre al abrir. */
  public readonly suggest = input('');
  /** Dentro de otra tarjeta (Editar catálogo): sin título ni borde propio. */
  public readonly embedded = input(false);
  public readonly suggestedQuery = signal(false);

  public readonly forbidden = signal(false);
  public readonly query = signal('');
  public readonly searching = signal(false);
  public readonly results = signal<SearchResult[]>([]);
  /** Moneda de la tienda (la decide el servidor por el país del catálogo). */
  public readonly currency = signal('usd');
  private readonly zeroDecimal = signal(false);
  /** Búsqueda inicial sugerida (nombre del catálogo). */
  private suggestion = '';
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
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private searchSeq = 0;
  private lastSearched = '';
  public readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  /** App nativa: el pago del dominio se hace en el navegador del sistema. */
  private readonly isNative = isNativeApp();
  private resumeTimers: ReturnType<typeof setTimeout>[] = [];

  async ngOnInit(): Promise<void> {
    this.destroyRef.onDestroy(() => {
      this.stopPolling();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.resumeTimers.forEach(clearTimeout);
    });
    if (this.isNative) void this.listenResume();
    this.tenantId = await this.tenantStore.getTenantIdAsync();
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('domain_session')) {
      this.toast.success('¡Pago recibido! Estamos registrando y conectando tu dominio.');
      this.clearReturnParams();
    } else if (qp.get('domain') === 'cancel') {
      this.clearReturnParams();
    }
    // Arranca con el nombre del catálogo (ej. "Barinas Parfum" -> barinasparfum)
    // para que vea de una vez dominios con su nombre. Se pone ya (con el
    // esqueleto de resultados) para que el campo no aparezca vacío mientras
    // se consulta el estado.
    const name = toDomainLabel(this.tenantStore.tenantName()) || toDomainLabel(this.suggest());
    this.suggestion = name;
    if (name) {
      this.query.set(name);
      this.searching.set(true);
    }
    await this.loadStatus();
    if (name && this.canBuy() && !this.forbidden()) {
      this.suggestedQuery.set(true);
      await this.search();
    } else if (name) {
      this.searching.set(false);
      if (this.query() === name) this.query.set('');
    }
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

  /** Mientras escribe: busca solo cuando deja de teclear unos segundos. */
  public onQueryChange(value: string): void {
    this.query.set(value);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const q = value.trim();
    if (q.length < 2 || q === this.lastSearched) return;
    this.debounceTimer = setTimeout(() => this.search(), SEARCH_DEBOUNCE_MS);
  }

  public async search(): Promise<void> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    if (this.query().trim() !== this.suggestion) this.suggestedQuery.set(false);
    const q = this.query().trim();
    if (!q) return;
    // Si llega una búsqueda nueva mientras otra está en curso, gana la última.
    const seq = ++this.searchSeq;
    this.lastSearched = q;
    this.searching.set(true);
    const { data, error } = await this.call<{ results: SearchResult[]; currency?: string; zeroDecimal?: boolean }>({ action: 'search', query: q });
    if (seq !== this.searchSeq) return;
    this.searching.set(false);
    if (error) {
      this.lastSearched = '';
      this.toast.error(new Exception(error));
      return;
    }
    this.currency.set((data?.currency ?? 'usd').toLowerCase());
    this.zeroDecimal.set(!!data?.zeroDecimal);
    this.results.set(data?.results ?? []);
  }

  public firstYear(r: SearchResult): number {
    return r.firstYearPriceCents ?? r.priceCents ?? 0;
  }

  public hasIntro(r: SearchResult): boolean {
    return !!r.priceCents && this.firstYear(r) < r.priceCents;
  }

  public async buy(r: SearchResult): Promise<void> {
    if (this.buying()) return;
    this.buying.set(r.domain);
    // En la app nativa el pago va por Stripe en el navegador del sistema (un
    // dominio es un servicio fuera de la app: Apple 3.1.3(e), sin compra
    // in-app). Al terminar, Stripe lleva al catálogo público de la tienda (no
    // pide sesión); al volver a la app se refresca el estado del dominio.
    const nativeSlug = this.isNative ? getNativeSlug() : null;
    const nativeSite = nativeSlug ? `https://${nativeSlug}.catalogohoy.com/` : null;
    const returnUrl = nativeSite
      ?? (this.embedded()
        ? `${window.location.origin}${window.location.pathname}${window.location.search}`
        : `${window.location.origin}${window.location.pathname}?tab=domain`);
    // Tras pagar va a la pantalla de éxito (check + avance en vivo); si cancela, vuelve aquí.
    const successUrl = nativeSite ?? `${window.location.origin}/admin/plans/domain-success`;
    const { data, error } = await this.call<{ url: string }>({ action: 'checkout', domain: r.domain, returnUrl, successUrl });
    if (error || !data?.url) {
      this.buying.set(null);
      this.toast.error(new Exception(error ?? 'No pudimos iniciar el pago.'));
      return;
    }
    if (this.isNative) {
      // window.open tras un await lo bloquea el WebView (no es un toque
      // directo). Navegar a un dominio externo hace que Capacitor lo abra en
      // el navegador del sistema (Safari / Chrome) sin salir de la app.
      window.location.href = data.url;
      this.buying.set(null);
      this.toast.success('Completa el pago en el navegador. Al volver aquí verás tu dominio registrándose.');
      return;
    }
    window.location.href = data.url;
  }

  /** Al volver a la app (tras pagar en el navegador) refresca el estado del
   *  dominio unas veces: el webhook de Stripe puede tardar unos segundos. */
  private async listenResume(): Promise<void> {
    try {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('resume', () => {
        this.resumeTimers.forEach(clearTimeout);
        this.resumeTimers = [0, 4000, 12000].map((ms) => setTimeout(() => void this.loadStatus(), ms));
      });
      this.destroyRef.onDestroy(() => void handle.remove());
    } catch {
      /* sin plugin App: el usuario puede recargar la pestaña */
    }
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

  /** Precio en la moneda de la tienda ("$573.80 MXN"); USD si el servidor no
   *  mandó el monto local. */
  public price(localMinor: number | null | undefined, usdCents: number): string {
    const cur = this.currency();
    if (cur === 'usd' || localMinor == null) return this.money(usdCents);
    const zero = this.zeroDecimal();
    const major = zero ? localMinor : localMinor / 100;
    // Sin ",00" cuando el monto es redondo (COP, ARS, CLP…: miles sin centavos).
    const decimals = zero || Number.isInteger(major) ? 0 : 2;
    const n = major.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `$${n} ${cur.toUpperCase()}`;
  }
}

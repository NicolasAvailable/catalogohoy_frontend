import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { IconComponent } from '@ui';

interface OwnedDomain {
  id: string;
  domain: string;
  status: string;
}

type StepState = 'done' | 'current' | 'pending';

const FLOW = ['pending_payment', 'paid', 'registering', 'registered', 'connecting', 'active'];
const POLL_MS = 4000;
/** Si a los 10 min sigue en proceso, dejamos de consultar (el cron lo termina igual). */
const MAX_POLLS = 150;

/**
 * Pantalla de éxito al volver de pagar un dominio (Stripe → success_url).
 * Muestra el check grande y el avance en vivo: pago → registro → sincronización
 * con el catálogo (DNS + SSL) → listo. Consultar `status` también hace avanzar
 * la compra en el backend, así que mientras esta pantalla esté abierta va rápido.
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
          <div class="relative w-28 h-28 rounded-full bg-linear-to-br from-green-400 to-green-500 flex items-center justify-center shadow-xl shadow-green-200">
            <ui-icon name="check" styleClass="size-14 text-white" />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h1 class="text-3xl sm:text-4xl font-bold text-grey-800 leading-tight">
            {{ (isActive() ? '¡Tu catálogo ya está en tu dominio!' : '¡El dominio es tuyo!') | transloco }}
          </h1>
          @if (domain(); as d) {
            <p class="text-xl font-semibold text-primary-600 break-all" data-testid="domain-success-name">{{ d.domain }}</p>
          }
          <p class="text-base text-grey-500 leading-relaxed">
            @if (isActive()) {
              {{ 'Listo. Tus clientes ya pueden entrar a tu catálogo con este dominio.' | transloco }}
            } @else if (failed()) {
              {{ 'No pudimos completar la compra y te devolvimos el pago. Escríbenos si necesitas ayuda.' | transloco }}
            } @else {
              {{ 'Lo estamos conectando con tu catálogo. Tarda unos minutos y puedes salir de esta pantalla: sigue solo.' | transloco }}
            }
          </p>
        </div>

        @if (!failed()) {
          <ol class="w-full max-w-sm flex flex-col gap-3 text-left" data-testid="domain-success-steps">
            @for (step of steps(); track step.label) {
              <li class="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
                  [class]="step.state === 'done' ? 'border-green-200 bg-green-50' : step.state === 'current' ? 'border-primary-200 bg-primary-50' : 'border-grey-100 bg-white'">
                @if (step.state === 'done') {
                  <span class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <ui-icon name="check" styleClass="size-4 text-white" />
                  </span>
                } @else if (step.state === 'current') {
                  <span class="w-6 h-6 rounded-full border-2 border-primary-500 border-t-transparent animate-spin shrink-0"></span>
                } @else {
                  <span class="w-6 h-6 rounded-full border-2 border-grey-200 shrink-0"></span>
                }
                <span class="text-sm font-medium" [class]="step.state === 'pending' ? 'text-grey-400' : 'text-grey-700'">{{ step.label | transloco }}</span>
              </li>
            }
          </ol>
        }

        <div class="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-2">
          @if (isActive() && domain(); as d) {
            <a [href]="'https://' + d.domain" target="_blank" rel="noopener"
               class="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl whitespace-nowrap bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors shadow-lg shadow-primary-200">
              <ui-icon name="external-link" styleClass="size-5" />
              {{ 'Abrir mi catálogo' | transloco }}
            </a>
          }
          <button type="button" (click)="goToCatalog()" data-testid="domain-success-catalog"
                  class="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl whitespace-nowrap font-semibold transition-colors cursor-pointer"
                  [class]="isActive() ? 'border-2 border-grey-100 hover:bg-grey-50 text-grey-600' : 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-200'">
            <ui-icon name="palette" styleClass="size-5" />
            {{ 'Ir a Editar catálogo' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DomainSuccess implements OnInit, OnDestroy {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  public readonly domain = signal<OwnedDomain | null>(null);
  public readonly isActive = computed(() => this.domain()?.status === 'active');
  public readonly failed = computed(() => ['refunded', 'failed'].includes(this.domain()?.status ?? ''));

  public readonly steps = computed<{ label: string; state: StepState }[]>(() => {
    const i = FLOW.indexOf(this.domain()?.status ?? 'pending_payment');
    const at = (doneFrom: number, currentFrom: number): StepState =>
      i >= doneFrom ? 'done' : i >= currentFrom ? 'current' : 'pending';
    return [
      { label: 'Pago recibido', state: at(1, 0) },
      { label: 'Dominio registrado', state: at(3, 1) },
      { label: 'Sincronizando con tu catálogo (DNS y seguridad SSL)', state: at(5, 3) },
      { label: '¡Listo para tus clientes!', state: at(5, 5) },
    ];
  });

  private tenantId: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private polls = 0;
  private destroyed = false;

  async ngOnInit(): Promise<void> {
    this.tenantId = await this.tenantStore.getTenantIdAsync();
    await this.refresh();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async refresh(): Promise<void> {
    if (this.destroyed || !this.tenantId) return;
    const { data } = await this.client.functions.invoke('domains', {
      body: { tenantId: this.tenantId, action: 'status' },
    });
    const list = ((data as { domains?: OwnedDomain[] } | null)?.domains ?? []);
    // El más reciente (la edge los devuelve del más nuevo al más viejo).
    const latest = list[0] ?? null;
    if (latest) this.domain.set(latest);
    const done = latest && (latest.status === 'active' || this.failed() || latest.status === 'abandoned');
    if (!done && ++this.polls < MAX_POLLS && !this.destroyed) {
      this.timer = setTimeout(() => this.refresh(), POLL_MS);
    }
  }

  /** Recarga completa para que el editor tome el dominio nuevo como enlace del catálogo. */
  public goToCatalog(): void {
    window.location.assign('/admin/catalog/edit');
  }
}

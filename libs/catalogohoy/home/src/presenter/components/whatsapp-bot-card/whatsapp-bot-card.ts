import { Component, computed, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, DialogComponent, IconComponent, QrCodeComponent } from '@ui';
import { WaBotCode, WaBotLink, WaBotService } from '../../../infrastructure/wa-bot.service';

/** Tiendas con el bot habilitado (beta). Debe coincidir con WA_BOT_TENANTS de
 *  la edge `wa-store-bot`. 6 = catálogo de CatalogoHoy. */
const BOT_BETA_TENANTS = [6];
/** Cada cuánto se revisa si el número ya quedó conectado mientras hay un código activo. */
const POLL_MS = 3000;

/**
 * "Gestiona tu tienda por WhatsApp" (CAT-78, beta): el dueño genera un código
 * y lo manda al número de avisos para vincular su WhatsApp. Desde ahí crea y
 * edita productos, sube fotos y consulta órdenes conversando con el bot.
 * Con el código activo se muestra un QR (desde la compu se escanea con el
 * teléfono) y la tarjeta se actualiza sola cuando el número queda conectado.
 * Máximo `maxLinks` números por tienda (lo impone la edge).
 */
/**
 * "Gestiona tu tienda por WhatsApp" (CAT-78, beta): el dueño genera un código
 * y lo manda al número de avisos para vincular su WhatsApp. Desde ahí crea y
 * edita productos, sube fotos y gestiona órdenes conversando con el bot.
 * Sin conectar se ve una mini landing (resumen a la izquierda, captura real del
 * chat en un mockup de iPhone a la derecha). "Conectar" abre un modal con los
 * pasos; ahí se genera el código + QR y el modal se cierra solo al conectar.
 * Máximo `maxLinks` números por tienda (lo impone la edge).
 */
@Component({
  selector: 'app-whatsapp-bot-card',
  standalone: true,
  imports: [ButtonComponent, DialogComponent, IconComponent, QrCodeComponent],
  template: `
    @if (visible()) {
    <div class="bg-white border border-grey-100 rounded-xl shadow-sm overflow-hidden">
      <!-- Encabezado: logo de WhatsApp + título + acción compacta a la derecha -->
      <div class="flex flex-wrap items-center gap-3 p-4">
        <span class="shrink-0 w-11 h-11 rounded-xl bg-white border border-grey-100 shadow-sm flex items-center justify-center">
          <img src="/images/whatsapp.svg" alt="WhatsApp" class="w-6 h-6" />
        </span>
        <div class="flex-1 min-w-[12rem]">
          <p class="font-semibold text-grey-800">
            Gestiona tu tienda por WhatsApp
            <span class="ml-1 text-[11px] font-medium uppercase tracking-wide text-primary-500 bg-primary-50 rounded px-1.5 py-0.5">Beta</span>
          </p>
          <p class="text-sm text-grey-500">Tu asistente de CatalogoHoy, en el chat que ya usas todos los días.</p>
        </div>
        @if (links().length && !full()) {
        <div class="shrink-0">
          <ui-button label="Conectar otro número" icon="plus" variant="outlined" size="small" [fluid]="false" (click)="openConnect()" />
        </div>
        }
      </div>

      @if (!links().length) {
      <!-- Sin conectar: resumen (izquierda) + captura real en iPhone (derecha) -->
      <div class="grid md:grid-cols-5 gap-6 lg:gap-10 items-center border-t border-grey-100 bg-lino-400 px-4 sm:px-6 pt-5 md:pt-0">
        <div class="md:col-span-3 flex flex-col md:py-6">
          @for (f of features; track f.title) {
          <div class="flex items-start gap-3 py-3 border-b border-grey-100 last:border-b-0 first:pt-0">
            <span class="shrink-0 w-8 h-8 rounded-lg bg-white border border-grey-100 flex items-center justify-center">
              <ui-icon [name]="f.icon" [size]="16" styleClass="text-primary-500" />
            </span>
            <div>
              <p class="text-[0.95rem] font-semibold text-grey-800">{{ f.title }}</p>
              <p class="text-sm text-grey-500 mt-0.5 leading-relaxed">{{ f.description }}</p>
            </div>
          </div>
          }
          <div class="flex flex-wrap items-center gap-3 pt-4">
            <ui-button label="Conectar mi WhatsApp" icon="arrow-right" iconPos="right" [fluid]="false" (click)="openConnect()" />
            <span class="text-xs text-grey-400">Toma menos de un minuto.</span>
          </div>
        </div>

        <!-- Mockup de iPhone con una conversación real con el asistente -->
        <div class="md:col-span-2 flex justify-center pb-5 md:py-6">
          <div class="relative w-[12.5rem] rounded-[2.2rem] border-[7px] border-grey-800 bg-grey-800 shadow-xl shadow-grey-300/40">
            <span class="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-4 rounded-full bg-black z-10"></span>
            <img src="/images/wa-bot-chat.webp" alt="Chat con el asistente de CatalogoHoy creando un producto desde una foto" class="w-full block rounded-[1.75rem]" loading="lazy" />
          </div>
        </div>
      </div>
      } @else {
      <!-- Conectado: números vinculados -->
      <div class="flex flex-col gap-2 px-4 pb-4">
        @for (link of links(); track link.id) {
        <div class="flex items-center justify-between gap-2 text-sm bg-lino-400 rounded-lg px-3 py-2">
          <span class="inline-flex items-center gap-2 text-grey-700">
            <ui-icon name="circle-check" [size]="16" styleClass="text-green-500" /> Conectado: <strong>+{{ link.phone }}</strong>
          </span>
          <button type="button" class="text-grey-500 hover:text-red-500 text-xs underline cursor-pointer" (click)="unlink(link)">
            Desconectar
          </button>
        </div>
        }
        <p class="text-xs text-grey-400">
          {{ full() ? 'Llegaste al máximo de ' + maxLinks() + ' números. Desconecta uno para conectar otro.' : 'Puedes conectar hasta ' + maxLinks() + ' números.' }}
        </p>
      </div>
      }
    </div>

    <!-- Modal de conexión: explica los pasos, genera el código y espera el mensaje -->
    <ui-dialog styleClass="max-w-lg w-full" (close)="stopWaiting()">
      <div class="flex flex-col gap-5 p-2">
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-xl bg-white border border-grey-100 shadow-sm flex items-center justify-center shrink-0">
            <img src="/images/whatsapp.svg" alt="" class="w-6 h-6" />
          </span>
          <div>
            <h3 class="font-semibold text-grey-700">Conecta tu WhatsApp</h3>
            <p class="text-sm text-grey-400">Vinculamos tu número con un código de un solo uso.</p>
          </div>
        </div>

        @if (code(); as c) {
        <div class="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-grey-100 bg-lino-400 p-4">
          <div class="bg-white rounded-lg p-1 shrink-0 border border-grey-100">
            <qrcode [qrdata]="c.waLink" [width]="136" [margin]="1" errorCorrectionLevel="M"></qrcode>
          </div>
          <div class="flex flex-col gap-2 text-sm text-grey-600">
            <p>Escanea el código con la cámara de tu teléfono, o toca <strong>Abrir WhatsApp</strong> si ya estás en el teléfono.</p>
            <p>Envía el mensaje <span class="font-mono font-semibold text-grey-800">Vincular {{ c.code }}</span> sin cambiarlo.</p>
            <a [href]="c.waLink" target="_blank" rel="noopener"
               class="self-start inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 text-white px-3 py-2 font-semibold hover:bg-primary-600 transition-colors">
              <ui-icon name="send" [size]="16" /> Abrir WhatsApp
            </a>
          </div>
        </div>
        <p class="inline-flex items-center gap-2 text-xs text-grey-400">
          <ui-icon name="loaderCircle" [size]="14" styleClass="animate-spin" />
          Esperando tu mensaje… El código vence en {{ remaining() }}.
        </p>
        } @else {
        <ol class="flex flex-col gap-3">
          @for (step of steps; track step.title; let i = $index) {
          <li class="flex items-start gap-3">
            <span class="shrink-0 w-7 h-7 rounded-full bg-primary-50 text-primary-500 text-sm font-semibold flex items-center justify-center">{{ i + 1 }}</span>
            <div>
              <p class="text-sm font-semibold text-grey-700">{{ step.title }}</p>
              <p class="text-sm text-grey-500 leading-relaxed">{{ step.description }}</p>
            </div>
          </li>
          }
        </ol>
        <div class="flex items-start gap-2 rounded-lg bg-lino-400 px-3 py-2.5 text-xs text-grey-500">
          <ui-icon name="shield-check" [size]="16" styleClass="text-primary-500 shrink-0" />
          <span>El código vence en 10 minutos y sirve una sola vez. Puedes conectar hasta {{ maxLinks() }} números y desconectarlos cuando quieras.</span>
        </div>
        <div class="flex justify-end gap-2">
          <ui-button label="Cancelar" variant="text" severity="secondary" [fluid]="false" (click)="dialog.hide()" />
          <ui-button label="Generar código" icon="qr-code" [fluid]="false" [isLoading]="loading()" (click)="generateCode()" />
        </div>
        }
      </div>
    </ui-dialog>
    }
  `,
})
export class WhatsappBotCard implements OnInit, OnDestroy {
  private readonly tenantStore = inject(TenantStore);
  private readonly service = inject(WaBotService);
  private readonly toast = inject(ToastService);

  private tenantId: number | null = null;
  public readonly visible = signal(false);
  public readonly loading = signal(false);
  public readonly links = signal<WaBotLink[]>([]);
  public readonly code = signal<WaBotCode | null>(null);
  public readonly features = [
    { icon: 'package', title: 'Productos con una foto', description: 'Manda la foto con nombre y precio y queda publicado en tu catálogo.' },
    { icon: 'tag', title: 'Precios y stock con un mensaje', description: 'Cambia precios, ofertas, inventario y fotos sin entrar al panel.' },
    { icon: 'clipboard-list', title: 'Órdenes al día', description: 'Crea ventas, márcalas como pagadas o canceladas, y tu stock se ajusta solo.' },
    { icon: 'trending-up', title: 'Tus ventas al instante', description: 'Pregunta cuánto vendiste o qué se vende más, en cualquier momento.' },
  ];
  public readonly steps = [
    { title: 'Genera tu código', description: 'Te mostramos un código QR y un mensaje con un código de 8 dígitos.' },
    { title: 'Envíalo desde tu WhatsApp', description: 'Escanea el QR con tu teléfono (o toca Abrir WhatsApp) y manda el mensaje tal cual.' },
    { title: 'Listo, empieza a chatear', description: 'Este modal se cierra solo y el asistente te saluda. Mándale una foto para crear tu primer producto.' },
  ];
  public readonly maxLinks = signal(2);
  public readonly full = computed(() => this.links().length >= this.maxLinks());
  private readonly secondsLeft = signal(0);
  public readonly remaining = computed(() => {
    const s = this.secondsLeft();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  @ViewChild(DialogComponent) public dialog!: DialogComponent;

  public async ngOnInit(): Promise<void> {
    const id = Number(await this.tenantStore.getTenantIdAsync());
    if (!BOT_BETA_TENANTS.includes(id)) return;
    this.tenantId = id;
    this.visible.set(true);
    await this.refresh();
  }

  public async generateCode(): Promise<void> {
    if (!this.tenantId) return;
    this.loading.set(true);
    const result = await this.service.createCode(this.tenantId);
    this.loading.set(false);
    result
      .mapRight((c) => this.startWaiting(c))
      .mapLeft(() => this.toast.warning('No se pudo generar el código. Intenta de nuevo.'));
  }

  public openConnect(): void {
    this.stopWaiting();
    this.dialog.show();
  }

  public ngOnDestroy(): void {
    this.stopWaiting();
  }

  /** Muestra el código y revisa cada POLL_MS si el número ya se conectó. */
  private startWaiting(c: WaBotCode): void {
    this.stopWaiting();
    this.code.set(c);
    this.secondsLeft.set(c.expiresInMinutes * 60);
    const before = new Set(this.links().map((l) => l.id));
    this.tickTimer = setInterval(() => {
      this.secondsLeft.update((s) => s - 1);
      if (this.secondsLeft() <= 0) this.dialog.hide();
    }, 1000);
    this.pollTimer = setInterval(async () => {
      await this.refresh();
      const added = this.links().find((l) => !before.has(l.id));
      if (added) {
        this.dialog.hide();
        this.stopWaiting();
        this.toast.success(`¡Listo! +${added.phone} quedó conectado al asistente.`);
      }
    }, POLL_MS);
  }

  public stopWaiting(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.pollTimer = this.tickTimer = null;
    this.code.set(null);
  }

  public async unlink(link: WaBotLink): Promise<void> {
    if (!this.tenantId) return;
    const result = await this.service.unlink(this.tenantId, link.id);
    result
      .mapRight(() => this.links.update((list) => list.filter((l) => l.id !== link.id)))
      .mapLeft(() => this.toast.warning('No se pudo desconectar.'));
  }

  private async refresh(): Promise<void> {
    if (!this.tenantId) return;
    const result = await this.service.getStatus(this.tenantId);
    result.mapRight((s) => {
      this.links.set(s.links);
      if (s.maxLinks) this.maxLinks.set(s.maxLinks);
    });
  }
}

import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import { IconComponent, QrCodeComponent } from '@ui';
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
@Component({
  selector: 'app-whatsapp-bot-card',
  standalone: true,
  imports: [IconComponent, QrCodeComponent],
  template: `
    @if (visible()) {
    <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <!-- Encabezado: logo de WhatsApp + título + acción compacta a la derecha -->
      <div class="flex flex-wrap items-center gap-3 p-4">
        <span class="shrink-0 w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <img src="/images/whatsapp.svg" alt="WhatsApp" class="w-6 h-6" />
        </span>
        <div class="flex-1 min-w-[12rem]">
          <p class="font-semibold text-slate-900">
            Gestiona tu tienda por WhatsApp
            <span class="ml-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">Beta</span>
          </p>
          <p class="text-sm text-slate-600">Tu asistente de CatalogoHoy, en el chat que ya usas todos los días.</p>
        </div>
        @if (!code() && links().length && !full()) {
        <button type="button" [disabled]="loading()" (click)="generateCode()"
          class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60">
          <ui-icon name="plus" [size]="16" /> Conectar otro número
        </button>
        }
      </div>

      @if (code(); as c) {
      <!-- Código activo: QR + pasos; se cierra solo al conectar -->
      <div class="mx-4 mb-4 text-sm bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex flex-col sm:flex-row gap-3 items-center">
        <div class="bg-white rounded-lg p-1 shrink-0">
          <qrcode [qrdata]="c.waLink" [width]="148" [margin]="1" errorCorrectionLevel="M"></qrcode>
        </div>
        <div class="flex flex-col gap-2 text-slate-700">
          <p><strong>1.</strong> Escanea el código con la cámara de tu teléfono, o toca <em>Abrir WhatsApp</em> si ya estás en el teléfono.</p>
          <p><strong>2.</strong> Envía el mensaje que aparece (<span class="font-mono">Vincular {{ c.code }}</span>) sin cambiarlo.</p>
          <a [href]="c.waLink" target="_blank" rel="noopener"
             class="self-start inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-3 py-2 font-medium hover:bg-emerald-700">
            <ui-icon name="send" [size]="16" /> Abrir WhatsApp
          </a>
          <p class="text-xs text-slate-500">
            Esperando tu mensaje… El código vence en {{ remaining() }}.
            <button type="button" class="underline cursor-pointer" (click)="cancelCode()">Cancelar</button>
          </p>
        </div>
      </div>
      } @else if (!links().length) {
      <!-- Sin conectar: mini landing informativa -->
      <div class="grid md:grid-cols-5 gap-5 items-center border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
        <div class="md:col-span-3 flex flex-col gap-3">
          @for (f of features; track f.title) {
          <div class="flex items-start gap-3">
            <span class="shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
              <ui-icon [name]="f.icon" [size]="16" class="text-emerald-600" />
            </span>
            <div>
              <p class="text-sm font-semibold text-slate-800">{{ f.title }}</p>
              <p class="text-xs text-slate-500 leading-relaxed">{{ f.description }}</p>
            </div>
          </div>
          }
          <div class="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" [disabled]="loading()" (click)="generateCode()"
              class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 cursor-pointer disabled:opacity-60">
              <img src="/images/whatsapp.svg" alt="" class="w-4 h-4 brightness-0 invert" />
              {{ loading() ? 'Generando…' : 'Conectar mi WhatsApp' }}
            </button>
            <span class="text-xs text-slate-400">Toma menos de un minuto.</span>
          </div>
        </div>

        <!-- Así se ve: mini chat de ejemplo -->
        <div class="md:col-span-2 hidden sm:flex justify-center">
          <div class="w-full max-w-[16rem] rounded-2xl border border-slate-200 bg-[#efeae2] shadow-md overflow-hidden text-[12px]">
            <div class="flex items-center gap-2 bg-emerald-700 text-white px-3 py-2">
              <img src="/images/whatsapp.svg" alt="" class="w-4 h-4 brightness-0 invert" />
              <span class="font-semibold">Asistente CatalogoHoy</span>
            </div>
            <div class="flex flex-col gap-1.5 p-2.5">
              <span class="self-end max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2 py-1 text-slate-800 shadow-sm">
                📸 Crea Franela negra, $15, stock 10
              </span>
              <span class="self-start max-w-[85%] rounded-lg rounded-tl-none bg-white px-2 py-1 text-slate-800 shadow-sm">
                ✅ Listo, creé <strong>Franela negra</strong> con tu foto.
              </span>
              <span class="self-end max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2 py-1 text-slate-800 shadow-sm">
                Marca la orden #120 como pagada
              </span>
              <span class="self-start max-w-[85%] rounded-lg rounded-tl-none bg-white px-2 py-1 text-slate-800 shadow-sm">
                Hecho 👍 Al cliente le llegó el aviso.
              </span>
            </div>
          </div>
        </div>
      </div>
      } @else {
      <!-- Conectado: números vinculados -->
      <div class="flex flex-col gap-2 px-4 pb-4">
        @for (link of links(); track link.id) {
        <div class="flex items-center justify-between gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
          <span class="text-slate-700">✅ Conectado: <strong>+{{ link.phone }}</strong></span>
          <button type="button" class="text-slate-500 hover:text-red-600 text-xs underline cursor-pointer" (click)="unlink(link)">
            Desconectar
          </button>
        </div>
        }
        <p class="text-xs text-slate-400">
          {{ full() ? 'Llegaste al máximo de ' + maxLinks() + ' números. Desconecta uno para conectar otro.' : 'Puedes conectar hasta ' + maxLinks() + ' números.' }}
        </p>
      </div>
      }
    </div>
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
    { icon: 'clipboard-list', title: 'Órdenes al día', description: 'Crea ventas, márcalas como pagadas o canceladas, y tu stock se ajusta solo.' },
    { icon: 'trending-up', title: 'Tus ventas al instante', description: 'Pregunta cuánto vendiste o qué se vende más, en cualquier momento.' },
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

  public cancelCode(): void {
    this.stopWaiting();
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
      if (this.secondsLeft() <= 0) this.stopWaiting();
    }, 1000);
    this.pollTimer = setInterval(async () => {
      await this.refresh();
      const added = this.links().find((l) => !before.has(l.id));
      if (added) {
        this.stopWaiting();
        this.toast.success(`¡Listo! +${added.phone} quedó conectado al asistente.`);
      }
    }, POLL_MS);
  }

  private stopWaiting(): void {
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

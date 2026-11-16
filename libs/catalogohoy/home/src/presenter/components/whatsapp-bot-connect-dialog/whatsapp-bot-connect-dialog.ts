import { Component, computed, inject, input, OnDestroy, output, signal, ViewChild } from '@angular/core';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, DialogComponent, IconComponent, QrCodeComponent } from '@ui';
import { WaBotCode, WaBotLink, WaBotService } from '../../../infrastructure/wa-bot.service';

/** Cada cuánto se revisa si el número ya quedó conectado mientras hay un código activo. */
const POLL_MS = 3000;

/**
 * Modal "Conecta tu WhatsApp" del asistente (CAT-78): explica los pasos,
 * genera el código de un solo uso + QR y espera el mensaje "Vincular …".
 * Se cierra solo cuando el número queda conectado y emite `connected`.
 */
@Component({
  selector: 'lib-whatsapp-bot-connect-dialog',
  standalone: true,
  imports: [ButtonComponent, DialogComponent, IconComponent, QrCodeComponent],
  template: `
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
  `,
})
export class WhatsappBotConnectDialog implements OnDestroy {
  private readonly service = inject(WaBotService);
  private readonly toast = inject(ToastService);

  public readonly tenantId = input<number | null>(null);
  public readonly maxLinks = input(2);
  public readonly connected = output<WaBotLink>();

  @ViewChild(DialogComponent) public dialog!: DialogComponent;

  public readonly steps = [
    { title: 'Genera tu código', description: 'Te mostramos un código QR y un mensaje con un código de 8 dígitos.' },
    { title: 'Envíalo desde tu WhatsApp', description: 'Escanea el QR con tu teléfono (o toca Abrir WhatsApp) y manda el mensaje tal cual.' },
    { title: 'Listo, empieza a chatear', description: 'Este modal se cierra solo y el asistente te saluda. Mándale una foto para crear tu primer producto.' },
  ];
  public readonly loading = signal(false);
  public readonly code = signal<WaBotCode | null>(null);
  private readonly secondsLeft = signal(0);
  public readonly remaining = computed(() => {
    const s = this.secondsLeft();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  public show(): void {
    this.stopWaiting();
    this.dialog.show();
  }

  public async generateCode(): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) return;
    this.loading.set(true);
    const result = await this.service.createCode(tenantId);
    this.loading.set(false);
    result
      .mapRight((c) => this.startWaiting(tenantId, c))
      .mapLeft(() => this.toast.warning('No se pudo generar el código. Intenta de nuevo.'));
  }

  public ngOnDestroy(): void {
    this.stopWaiting();
  }

  /** Muestra el código y revisa cada POLL_MS si apareció un número nuevo. */
  private async startWaiting(tenantId: number, c: WaBotCode): Promise<void> {
    this.stopWaiting();
    this.code.set(c);
    this.secondsLeft.set(c.expiresInMinutes * 60);
    const status = await this.service.getStatus(tenantId);
    const before = new Set(status.isRight() ? status.value.links.map((l) => l.id) : []);
    this.tickTimer = setInterval(() => {
      this.secondsLeft.update((s) => s - 1);
      if (this.secondsLeft() <= 0) this.dialog.hide();
    }, 1000);
    this.pollTimer = setInterval(async () => {
      const result = await this.service.getStatus(tenantId);
      if (!result.isRight()) return;
      const added = result.value.links.find((l) => !before.has(l.id));
      if (added) {
        this.dialog.hide();
        this.stopWaiting();
        this.toast.success(`¡Listo! +${added.phone} quedó conectado al asistente.`);
        this.connected.emit(added);
      }
    }, POLL_MS);
  }

  public stopWaiting(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.pollTimer = this.tickTimer = null;
    this.code.set(null);
  }
}

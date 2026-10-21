import { Component, inject, OnInit, signal } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent } from '@ui';
import { WaBotCode, WaBotLink, WaBotService } from '../../../infrastructure/wa-bot.service';

/** Tiendas con el bot habilitado (beta). Debe coincidir con WA_BOT_TENANTS de
 *  la edge `wa-store-bot`. 6 = catálogo de CatalogoHoy. */
const BOT_BETA_TENANTS = [6];

/**
 * "Gestiona tu tienda por WhatsApp" (CAT-78, beta): el dueño genera un código
 * y lo manda al número de avisos para vincular su WhatsApp. Desde ahí crea y
 * edita productos, sube fotos y consulta órdenes conversando con el bot.
 */
@Component({
  selector: 'app-whatsapp-bot-card',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  template: `
    @if (visible()) {
    <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <div class="shrink-0 w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
          <ui-icon name="message-circle" [size]="20" class="text-emerald-600" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-900">
            Gestiona tu tienda por WhatsApp
            <span class="ml-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">Beta</span>
          </p>
          <p class="text-sm text-slate-600">
            Crea y edita productos, sube fotos y consulta tus órdenes escribiéndole a nuestro asistente.
          </p>
        </div>
      </div>

      @for (link of links(); track link.id) {
      <div class="flex items-center justify-between gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
        <span class="text-slate-700">✅ Conectado: <strong>+{{ link.phone }}</strong></span>
        <button type="button" class="text-slate-500 hover:text-red-600 text-xs underline cursor-pointer" (click)="unlink(link)">
          Desconectar
        </button>
      </div>
      }

      @if (code(); as c) {
      <div class="text-sm bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex flex-col gap-2">
        <p class="text-slate-700">
          Envía este mensaje desde tu WhatsApp (vence en {{ c.expiresInMinutes }} min):
          <strong class="font-mono">Vincular {{ c.code }}</strong>
        </p>
        <a [href]="c.waLink" target="_blank" rel="noopener"
           class="self-start inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-3 py-2 font-medium hover:bg-emerald-700">
          <ui-icon name="send" [size]="16" /> Abrir WhatsApp
        </a>
      </div>
      } @else {
      <ui-button
        [label]="links().length ? 'Conectar otro número' : 'Conectar mi WhatsApp'"
        [isLoading]="loading()"
        (click)="generateCode()"
      />
      }
    </div>
    }
  `,
})
export class WhatsappBotCard implements OnInit {
  private readonly tenantStore = inject(TenantStore);
  private readonly service = inject(WaBotService);
  private readonly toast = inject(ToastService);

  private tenantId: number | null = null;
  public readonly visible = signal(false);
  public readonly loading = signal(false);
  public readonly links = signal<WaBotLink[]>([]);
  public readonly code = signal<WaBotCode | null>(null);

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
      .mapRight((c) => this.code.set(c))
      .mapLeft(() => this.toast.warning('No se pudo generar el código. Intenta de nuevo.'));
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
    result.mapRight((s) => this.links.set(s.links));
  }
}

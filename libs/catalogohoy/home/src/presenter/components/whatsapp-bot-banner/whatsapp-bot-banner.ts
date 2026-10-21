import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantStore } from '@catalogohoy/tenant';
import { IconComponent } from '@ui';
import { WA_BOT_BETA_TENANTS } from '../../../infrastructure/wa-bot.service';

const DISMISS_KEY = 'wa_bot_banner_dismissed';

/**
 * Anuncio en Inicio del asistente de WhatsApp (CAT-78, beta): mismo formato que
 * la promo de la app móvil. Lleva a la vista completa (/admin/whatsapp-bot).
 * Descartable (localStorage); solo tiendas habilitadas.
 */
@Component({
  selector: 'lib-whatsapp-bot-banner',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    @if (visible()) {
    <div class="relative flex flex-col gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm -mt-1 sm:flex-row sm:items-center">
      <button
        type="button"
        (click)="dismiss()"
        class="absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer sm:static sm:order-last"
        aria-label="Descartar"
      >
        <ui-icon name="x" [size]="16" />
      </button>

      <div class="flex items-center gap-3 flex-1 min-w-0 pr-8 sm:pr-0">
        <div class="shrink-0 w-9 h-9 rounded-lg bg-white border border-grey-100 flex items-center justify-center">
          <img src="/images/whatsapp.svg" alt="WhatsApp" class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-800 leading-tight">
            ¡Ya puedes gestionar tu catálogo desde WhatsApp!
            <span class="ml-1 align-middle text-[10px] font-semibold uppercase tracking-wide text-primary-500 bg-primary-50 rounded px-1.5 py-0.5">Beta</span>
          </p>
          <p class="hidden sm:block text-xs text-slate-500 mt-0.5 leading-snug">
            Solo habla con nuestro asistente: crea productos con una foto, cambia precios y maneja tus órdenes desde una conversación.
          </p>
        </div>
      </div>

      <a
        routerLink="/admin/whatsapp-bot"
        class="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors"
      >
        Conocer más <ui-icon name="arrow-right" [size]="16" />
      </a>
    </div>
    }
  `,
})
export class WhatsappBotBanner implements OnInit {
  private readonly tenantStore = inject(TenantStore);
  public readonly visible = signal(false);

  public async ngOnInit(): Promise<void> {
    const id = Number(await this.tenantStore.getTenantIdAsync());
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* localStorage no disponible → se muestra */
    }
    this.visible.set(WA_BOT_BETA_TENANTS.includes(id) && !dismissed);
  }

  public dismiss(): void {
    this.visible.set(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* no persiste, sin drama */
    }
  }
}

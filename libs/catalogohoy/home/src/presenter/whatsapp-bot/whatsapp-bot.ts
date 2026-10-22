import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent } from '@ui';
import {
  isWaBotEnabled,
  WaBotLink,
  WaBotMessage,
  WaBotService,
  WaBotStats,
} from '../../infrastructure/wa-bot.service';
import { WhatsappBotConnectDialog } from '../components/whatsapp-bot-connect-dialog/whatsapp-bot-connect-dialog';

/** Cada cuánto se buscan mensajes nuevos en el registro. */
const REFRESH_MS = 15000;
const PAGE = 60;

/** Créditos de IA al mes por plan (ver `ensure_ai_credits` en la BD). */
const PLAN_CREDITS = [
  { plan: 'Gratis', credits: 15 },
  { plan: 'Básico', credits: 200 },
  { plan: 'Pro', credits: 350 },
  { plan: 'Avanzado', credits: 500 },
  { plan: 'Enterprise', credits: 2000 },
];

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Formato de WhatsApp (*negrita*, _cursiva_) y links, sobre texto escapado. */
const waToHtml = (s: string) =>
  escapeHtml(s)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline text-primary-600">$1</a>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<strong>$2</strong>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');

/**
 * "Asistente WhatsApp" (CAT-78, beta): vista completa del bot que gestiona la
 * tienda por WhatsApp. Sin conectar es una landing (qué hace, paso a paso,
 * precios). Conectado muestra el gasto de créditos, los números vinculados y
 * el registro de la conversación (lo que se dijeron y qué cambió).
 */
@Component({
  selector: 'lib-whatsapp-bot',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonComponent, IconComponent, WhatsappBotConnectDialog],
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto bg-lino-400' },
  templateUrl: './whatsapp-bot.html',
})
export class WhatsappBot implements OnInit, OnDestroy {
  private readonly tenantStore = inject(TenantStore);
  private readonly service = inject(WaBotService);
  private readonly toast = inject(ToastService);

  @ViewChild(WhatsappBotConnectDialog) private connectDialog!: WhatsappBotConnectDialog;
  @ViewChild('log') private logEl?: ElementRef<HTMLElement>;

  protected readonly tenantId = signal<number | null>(null);
  protected readonly enabled = signal(false);
  protected readonly ready = signal(false);
  protected readonly links = signal<WaBotLink[]>([]);
  protected readonly maxLinks = signal(2);
  protected readonly full = computed(() => this.links().length >= this.maxLinks());
  protected readonly connected = computed(() => this.links().length > 0);

  protected readonly messages = signal<WaBotMessage[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly loadingLog = signal(false);
  protected readonly stats = signal<WaBotStats | null>(null);
  protected readonly phoneFilter = signal<string | null>(null);
  protected readonly creditCost = computed(() => this.stats()?.creditCost ?? 2);
  protected readonly messagesLeft = computed(() => Math.floor((this.stats()?.balance ?? 0) / this.creditCost()));

  protected readonly planRows = computed(() =>
    PLAN_CREDITS.map((p) => ({ ...p, messages: Math.floor(p.credits / this.creditCost()) }))
  );

  protected readonly capabilities = [
    {
      icon: 'camera',
      title: 'Crea productos con una foto',
      description: 'Manda la foto con nombre, precio y stock. El asistente escribe la descripción y lo publica.',
      example: '📸 Crea Franela FC Barcelona, $35, quedan 9',
    },
    {
      icon: 'tag',
      title: 'Cambia precios y stock',
      description: 'Edita uno o muchos productos a la vez: precios, ofertas, inventario, fotos o categorías.',
      example: 'Sube 10% todo lo de la categoría Gorras',
    },
    {
      icon: 'clipboard-list',
      title: 'Gestiona tus órdenes',
      description: 'Crea ventas, márcalas como pagadas, por cobrar o canceladas. El stock se ajusta solo.',
      example: 'Marca la orden #120 como pagada',
    },
    {
      icon: 'trending-up',
      title: 'Consulta tus ventas',
      description: 'Pregunta cuánto vendiste, qué se vende más o qué te queda poco en inventario.',
      example: '¿Cuánto vendí esta semana?',
    },
    {
      icon: 'package',
      title: 'Busca en tu catálogo',
      description: 'Pide fichas de tus productos con foto, precio y link para reenviarlas a tus clientes.',
      example: 'Mándame las franelas que tengan stock',
    },
    {
      icon: 'mic',
      title: 'Háblale como quieras',
      description: 'Escribe, manda fotos o notas de voz. Responde con los links al catálogo y al panel.',
      example: '🎤 Nota de voz: "agrega 5 unidades a la gorra negra"',
    },
  ];

  protected readonly connectSteps = [
    { icon: 'qr-code', title: 'Genera tu código', description: 'Toca Conectar mi WhatsApp y te mostramos un QR con un código de un solo uso.' },
    { icon: 'send', title: 'Envíalo desde tu teléfono', description: 'Escanea el QR o toca Abrir WhatsApp y manda el mensaje "Vincular …" tal cual.' },
    { icon: 'message-circle', title: 'Empieza a conversar', description: 'El asistente te saluda y ya puedes pedirle lo que necesites, cuando quieras.' },
  ];

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  public async ngOnInit(): Promise<void> {
    const id = Number(await this.tenantStore.getTenantIdAsync());
    this.tenantId.set(id || null);
    this.enabled.set(isWaBotEnabled(id));
    if (!this.enabled()) {
      this.ready.set(true);
      return;
    }
    await this.loadStatus();
    this.ready.set(true);
    if (this.connected()) await this.loadLog();
    this.refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && this.connected()) this.loadNew();
    }, REFRESH_MS);
  }

  public ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  protected openConnect(): void {
    this.connectDialog.show();
  }

  protected async onConnected(): Promise<void> {
    await this.loadStatus();
    await this.loadLog();
  }

  protected async unlink(link: WaBotLink): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) return;
    const result = await this.service.unlink(tenantId, link.id);
    result
      .mapRight(() => {
        this.links.update((list) => list.filter((l) => l.id !== link.id));
        if (this.phoneFilter() === link.phone) this.setFilter(null);
        this.toast.success(`+${link.phone} se desconectó del asistente.`);
      })
      .mapLeft(() => this.toast.warning('No se pudo desconectar.'));
  }

  protected setFilter(phone: string | null): void {
    this.phoneFilter.set(phone);
    this.loadLog();
  }

  /** Primera página (más reciente) del registro + estadísticas. */
  protected async loadLog(): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) return;
    this.loadingLog.set(true);
    const result = await this.service.getActivity(tenantId, { phone: this.phoneFilter(), limit: PAGE });
    this.loadingLog.set(false);
    result.mapRight((a) => {
      this.messages.set(a.messages);
      this.hasMore.set(a.hasMore);
      this.stats.set(a.stats);
      this.scrollToBottom();
    });
  }

  /** Mensajes anteriores (paginación hacia atrás). */
  protected async loadOlder(): Promise<void> {
    const tenantId = this.tenantId();
    const first = this.messages()[0];
    if (!tenantId || !first) return;
    this.loadingLog.set(true);
    const result = await this.service.getActivity(tenantId, { phone: this.phoneFilter(), before: first.id, limit: PAGE });
    this.loadingLog.set(false);
    result.mapRight((a) => {
      this.messages.update((list) => [...a.messages, ...list]);
      this.hasMore.set(a.hasMore);
    });
  }

  /** Agrega lo nuevo sin perder las páginas viejas ya cargadas. */
  private async loadNew(): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) return;
    const result = await this.service.getActivity(tenantId, { phone: this.phoneFilter(), limit: 20 });
    result.mapRight((a) => {
      const lastId = this.messages().at(-1)?.id ?? 0;
      const fresh = a.messages.filter((m) => m.id > lastId);
      if (fresh.length) {
        const el = this.logEl?.nativeElement;
        const atBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        this.messages.update((list) => [...list, ...fresh]);
        if (atBottom) this.scrollToBottom();
      }
      this.stats.set(a.stats);
    });
  }

  private async loadStatus(): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) return;
    const result = await this.service.getStatus(tenantId);
    result.mapRight((s) => {
      this.links.set(s.links);
      if (s.maxLinks) this.maxLinks.set(s.maxLinks);
    });
  }

  /** Lleva el registro al último mensaje (después de que Angular pinte). */
  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.logEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected html(body: string): string {
    return waToHtml(body);
  }

  /** ¿Empieza un día nuevo en el registro? (para el separador de fecha) */
  protected newDay(i: number): boolean {
    const list = this.messages();
    if (i === 0) return true;
    return new Date(list[i - 1].created_at).toDateString() !== new Date(list[i].created_at).toDateString();
  }
}

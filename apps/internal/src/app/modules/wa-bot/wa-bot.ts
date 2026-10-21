import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IconComponent } from '@ui';
import { WaBotAdminService, WaBotAdminStats, WaBotLogRow } from './wa-bot.service';

const PAGE = 100;

/**
 * Bot de WhatsApp (CAT-78): control diario del asistente de las tiendas.
 * Gasto (créditos y USD estimado), números conectados, y el registro completo
 * de cada conversación con su detalle técnico (herramientas, tokens, errores)
 * para depurar.
 */
@Component({
  selector: 'app-wa-bot',
  standalone: true,
  imports: [IconComponent, DatePipe, DecimalPipe, JsonPipe],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0 overflow-y-auto">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Bot de WhatsApp</h1>
        <p class="text-sm text-grey-400">
          Asistente de las tiendas (wa-store-bot): gasto, números conectados y el registro de cada conversación con su detalle técnico.
          El costo en USD es estimado con los precios de Sonnet 5.5.
        </p>
      </header>

      @if (error()) {
      <p class="text-sm text-red-500">{{ error() }}</p>
      }

      <!-- Métricas -->
      <section class="grid grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Mensajes hoy</span>
          <strong class="block text-xl font-bold text-grey-700">{{ stats()?.today?.messages ?? 0 }}</strong>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Costo hoy (USD)</span>
          <strong class="block text-xl font-bold text-grey-700">\${{ stats()?.today?.cost_usd ?? 0 | number: '1.2-4' }}</strong>
          <span class="text-xs text-grey-400">{{ stats()?.today?.credits ?? 0 }} créditos cobrados</span>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Mensajes 30 días</span>
          <strong class="block text-xl font-bold text-grey-700">{{ totals30().messages }}</strong>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Costo 30 días (USD)</span>
          <strong class="block text-xl font-bold text-grey-700">\${{ totals30().cost | number: '1.2-2' }}</strong>
          <span class="text-xs text-grey-400">≈ \${{ totals30().perMsg | number: '1.3-3' }} por mensaje</span>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Errores (7 días)</span>
          <strong class="block text-xl font-bold" [class]="(stats()?.errors_7d ?? 0) ? 'text-red-500' : 'text-grey-700'">{{ stats()?.errors_7d ?? 0 }}</strong>
        </article>
      </section>

      <section class="grid lg:grid-cols-2 gap-4 shrink-0">
        <!-- Por tienda -->
        <div class="bg-white rounded-xl border border-grey-50 overflow-hidden">
          <p class="px-4 py-3 font-semibold text-grey-700 border-b border-grey-50">Por tienda (histórico)</p>
          <table class="w-full text-sm">
            <thead class="text-xs text-grey-400 text-left">
              <tr><th class="px-4 py-2">Tienda</th><th class="px-2 py-2 text-right">Mensajes</th><th class="px-2 py-2 text-right">Créditos</th><th class="px-2 py-2 text-right">USD</th><th class="px-4 py-2 text-right">Último</th></tr>
            </thead>
            <tbody>
              @for (t of stats()?.by_tenant ?? []; track t.tenant_id) {
              <tr class="border-t border-grey-50 hover:bg-grey-50 cursor-pointer" (click)="filterTenant(t.tenant_id)">
                <td class="px-4 py-2 text-grey-700">{{ t.tenant_name ?? '#' + t.tenant_id }}</td>
                <td class="px-2 py-2 text-right">{{ t.messages }}</td>
                <td class="px-2 py-2 text-right">{{ t.credits }}</td>
                <td class="px-2 py-2 text-right">\${{ t.cost_usd | number: '1.2-2' }}</td>
                <td class="px-4 py-2 text-right text-grey-400">{{ t.last_at | date: 'd MMM, HH:mm' }}</td>
              </tr>
              } @empty {
              <tr><td colspan="5" class="px-4 py-6 text-center text-grey-400">Sin uso todavía</td></tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Números conectados -->
        <div class="bg-white rounded-xl border border-grey-50 overflow-hidden">
          <p class="px-4 py-3 font-semibold text-grey-700 border-b border-grey-50">Números conectados ({{ stats()?.links?.length ?? 0 }})</p>
          <table class="w-full text-sm">
            <thead class="text-xs text-grey-400 text-left">
              <tr><th class="px-4 py-2">Teléfono</th><th class="px-2 py-2">Tienda</th><th class="px-2 py-2">Usuario</th><th class="px-4 py-2 text-right">Último uso</th></tr>
            </thead>
            <tbody>
              @for (l of stats()?.links ?? []; track l.id) {
              <tr class="border-t border-grey-50 hover:bg-grey-50 cursor-pointer" (click)="filterPhone(l.phone)">
                <td class="px-4 py-2 font-medium text-grey-700">+{{ l.phone }}</td>
                <td class="px-2 py-2">{{ l.tenant_name ?? '#' + l.tenant_id }}</td>
                <td class="px-2 py-2 text-grey-500">{{ l.user_name ?? l.user_email }}</td>
                <td class="px-4 py-2 text-right text-grey-400">{{ (l.last_used_at ?? l.created_at) | date: 'd MMM, HH:mm' }}</td>
              </tr>
              } @empty {
              <tr><td colspan="4" class="px-4 py-6 text-center text-grey-400">Ningún número conectado</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Registro -->
      <section class="bg-white rounded-xl border border-grey-50 flex flex-col min-h-[36rem] shrink-0">
        <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-grey-50">
          <p class="font-semibold text-grey-700 mr-auto">Registro de conversaciones</p>
          @if (tenantFilter() || phoneFilter()) {
          <span class="text-xs rounded-full bg-grey-50 px-2.5 py-1 text-grey-600">
            {{ phoneFilter() ? '+' + phoneFilter() : 'Tienda #' + tenantFilter() }}
          </span>
          <button type="button" class="text-xs underline text-grey-500 cursor-pointer" (click)="clearFilter()">Quitar filtro</button>
          }
          <label class="inline-flex items-center gap-1.5 text-xs text-grey-500 cursor-pointer">
            <input type="checkbox" [checked]="showDebug()" (change)="showDebug.set(!showDebug())" /> Detalle técnico
          </label>
          <button type="button" (click)="load()" class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-grey-400 hover:text-grey-700 hover:bg-grey-50 cursor-pointer" aria-label="Actualizar">
            <ui-icon name="refresh-cw" size="16" [styleClass]="loading() ? 'animate-spin' : ''" />
          </button>
        </div>
        <div class="flex-1 bg-[#efeae2] px-4 py-4 flex flex-col gap-2">
          @if (hasMore()) {
          <button type="button" (click)="loadOlder()" class="self-center rounded-full bg-white px-3 py-1 text-xs font-medium text-grey-600 shadow-sm cursor-pointer">Ver anteriores</button>
          }
          @for (m of messages(); track m.id) {
          @if (m.role === 'system') {
          <div class="self-center max-w-[90%] flex flex-col items-center gap-1">
            <span class="text-center rounded-md px-2.5 py-1 text-[11px] shadow-sm" [class]="m.debug?.error ? 'bg-red-50 text-red-600' : 'bg-[#fff5c4] text-grey-600'">
              {{ m.body }} · +{{ m.phone }} · {{ m.created_at | date: 'd MMM HH:mm:ss' }}
            </span>
            @if (m.debug?.error) {
            <pre class="max-w-full overflow-x-auto rounded-md bg-white p-2 text-[10px] text-red-600 whitespace-pre-wrap">{{ m.debug?.error }}
{{ m.debug?.stack }}</pre>
            }
          </div>
          } @else {
          <div class="max-w-[85%] rounded-lg px-3 py-2 shadow-sm text-[13px] text-grey-800"
            [class]="m.role === 'user' ? 'self-end rounded-tr-none bg-[#d9fdd3]' : 'self-start rounded-tl-none bg-white'">
            <p class="text-[10px] font-semibold text-grey-400 mb-0.5">
              {{ m.role === 'user' ? '+' + m.phone : 'Asistente' }} · tienda #{{ m.tenant_id }} · {{ m.created_at | date: 'd MMM HH:mm:ss' }}
            </p>
            @if (m.media.length) {
            <div class="flex flex-wrap gap-1 mb-1">
              @for (f of m.media; track f.url) {
              @switch (f.type) {
              @case ('image') { <a [href]="f.url" target="_blank" rel="noopener"><img [src]="f.url" alt="" class="w-24 h-24 rounded object-cover" /></a> }
              @case ('video') { <video [src]="f.url" controls preload="metadata" class="w-56 max-h-56 rounded bg-black"></video> }
              @case ('audio') { <audio [src]="f.url" controls preload="none" class="w-56 h-10"></audio> }
              @default { <a [href]="f.url" target="_blank" rel="noopener" class="underline text-xs text-primary-600">📄 {{ f.name || 'Documento' }}</a> }
              }
              }
            </div>
            }
            <p class="whitespace-pre-line break-words">{{ m.body }}</p>
            @if (m.actions.length) {
            <ul class="mt-1.5 pt-1.5 border-t border-grey-50 text-xs text-primary-600">
              @for (a of m.actions; track $index) { <li>⚡ {{ a.label }}</li> }
            </ul>
            }
            @if (m.debug && showDebug()) {
            <div class="mt-2 pt-2 border-t border-grey-50 text-[11px] text-grey-500 flex flex-col gap-1">
              <p>
                {{ m.debug.model }} · {{ m.debug.ms }} ms · in {{ m.debug.usage?.input }} / out {{ m.debug.usage?.output }}
                / cache {{ m.debug.usage?.cacheRead }}r {{ m.debug.usage?.cacheWrite }}w · \${{ m.debug.cost_usd }} · {{ m.credits }} créditos
                · saldo {{ m.debug.balance_after }}
              </p>
              @for (t of m.debug.tools ?? []; track $index) {
              <details class="rounded bg-grey-50 px-2 py-1">
                <summary class="cursor-pointer" [class.text-red-500]="t.error">🔧 {{ t.name }} · {{ t.ms }} ms {{ t.error ? '· error' : '' }}</summary>
                <pre class="whitespace-pre-wrap break-all text-[10px] mt-1">IN  {{ t.input | json }}</pre>
                <pre class="whitespace-pre-wrap break-all text-[10px] mt-1">OUT {{ t.output }}</pre>
              </details>
              }
            </div>
            }
          </div>
          }
          } @empty {
          <p class="m-auto text-sm text-grey-500">{{ loading() ? 'Cargando…' : 'Sin mensajes registrados todavía.' }}</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class WaBot implements OnInit {
  private readonly service = inject(WaBotAdminService);

  protected readonly stats = signal<WaBotAdminStats | null>(null);
  protected readonly messages = signal<WaBotLogRow[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showDebug = signal(true);
  protected readonly tenantFilter = signal<number | null>(null);
  protected readonly phoneFilter = signal<string | null>(null);

  protected readonly totals30 = computed(() => {
    const days = this.stats()?.last_30d ?? [];
    const messages = days.reduce((a, d) => a + d.messages, 0);
    const cost = days.reduce((a, d) => a + Number(d.cost_usd), 0);
    return { messages, cost, perMsg: messages ? cost / messages : 0 };
  });

  public async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    const [stats, log] = await Promise.all([
      this.service.stats(),
      this.service.messages({ tenantId: this.tenantFilter(), phone: this.phoneFilter(), limit: PAGE }),
    ]);
    this.loading.set(false);
    stats.mapRight((s) => this.stats.set(s)).mapLeft((e) => this.error.set(e.message));
    log
      .mapRight((rows) => {
        this.messages.set(rows);
        this.hasMore.set(rows.length === PAGE);
      })
      .mapLeft((e) => this.error.set(e.message));
  }

  protected async loadOlder(): Promise<void> {
    const first = this.messages()[0];
    if (!first) return;
    this.loading.set(true);
    const log = await this.service.messages({ tenantId: this.tenantFilter(), phone: this.phoneFilter(), before: first.id, limit: PAGE });
    this.loading.set(false);
    log.mapRight((rows) => {
      this.messages.update((list) => [...rows, ...list]);
      this.hasMore.set(rows.length === PAGE);
    });
  }

  protected filterTenant(id: number): void {
    this.tenantFilter.set(id);
    this.phoneFilter.set(null);
    this.load();
  }

  protected filterPhone(phone: string): void {
    this.phoneFilter.set(phone);
    this.tenantFilter.set(null);
    this.load();
  }

  protected clearFilter(): void {
    this.tenantFilter.set(null);
    this.phoneFilter.set(null);
    this.load();
  }
}

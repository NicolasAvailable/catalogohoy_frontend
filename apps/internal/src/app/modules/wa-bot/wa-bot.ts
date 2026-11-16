import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IconComponent } from '@ui';
import { WaBotAdminService, WaBotAdminStats, WaBotLogRow, WaBotUserRow } from './wa-bot.service';

const PAGE = 100;

type UserView = 'recent' | 'top' | 'connected' | 'unused' | 'all';

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
          Asistente de las tiendas (wa-store-bot): quién lo usa, cuánto consume y el registro de cada conversación con su detalle técnico.
          El costo en USD es estimado con los precios de Sonnet 5.5.
        </p>
      </header>

      @if (error()) {
      <p class="text-sm text-red-500">{{ error() }}</p>
      }

      <!-- Resumen -->
      <section class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 shrink-0">
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Conectados</span>
          <strong class="block text-xl font-bold text-grey-700">{{ summary().connected }}</strong>
          <span class="text-xs text-grey-400">{{ summary().neverUsed }} sin usarlo aún</span>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Activos 7 días</span>
          <strong class="block text-xl font-bold text-grey-700">{{ summary().active7 }}</strong>
          <span class="text-xs text-grey-400">de {{ summary().users }} números</span>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Mensajes hoy</span>
          <strong class="block text-xl font-bold text-grey-700">{{ stats()?.today?.messages ?? 0 }}</strong>
          <span class="text-xs text-grey-400">\${{ stats()?.today?.cost_usd ?? 0 | number: '1.2-2' }} · {{ stats()?.today?.credits ?? 0 }} créditos</span>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Mensajes 30 días</span>
          <strong class="block text-xl font-bold text-grey-700">{{ totals30().messages }}</strong>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Créditos 30 días</span>
          <strong class="block text-xl font-bold text-grey-700">{{ totals30().credits }}</strong>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Costo IA 30 días</span>
          <strong class="block text-xl font-bold text-grey-700">\${{ totals30().cost | number: '1.2-2' }}</strong>
          <span class="text-xs text-grey-400">≈ \${{ totals30().perMsg | number: '1.3-3' }} por mensaje</span>
        </article>
        <article class="p-4 bg-white rounded-xl border border-grey-50">
          <span class="text-xs text-grey-400">Errores 7 días</span>
          <strong class="block text-xl font-bold" [class]="(stats()?.errors_7d ?? 0) ? 'text-red-500' : 'text-grey-700'">{{ stats()?.errors_7d ?? 0 }}</strong>
        </article>
      </section>

      <!-- Usuarios -->
      <section class="bg-white rounded-xl border border-grey-50 overflow-hidden shrink-0">
        <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-grey-50">
          <p class="font-semibold text-grey-700 mr-auto">Usuarios del asistente</p>
          @for (v of views; track v.key) {
          <button type="button" (click)="view.set(v.key)"
            class="rounded-full px-3 py-1 text-xs font-medium cursor-pointer"
            [class]="view() === v.key ? 'bg-primary-500 text-white' : 'bg-grey-50 text-grey-500 hover:text-grey-700'">
            {{ v.label }} ({{ counts()[v.key] }})
          </button>
          }
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap">
            <thead class="text-xs text-grey-400 text-left">
              <tr>
                <th class="px-4 py-2">Usuario y tienda</th>
                <th class="px-2 py-2">Nivel</th>
                <th class="px-2 py-2 text-right">Msj 7d</th>
                <th class="px-2 py-2 text-right">Msj 30d</th>
                <th class="px-2 py-2 text-right">Msj total</th>
                <th class="px-2 py-2 text-right">Créditos 30d</th>
                <th class="px-2 py-2 text-right">Créditos total</th>
                <th class="px-2 py-2 text-right">Costo IA total</th>
                <th class="px-2 py-2 text-right">Saldo</th>
                <th class="px-4 py-2 text-right">Último uso</th>
              </tr>
            </thead>
            <tbody>
              @for (u of visibleUsers(); track u.tenant_id + '-' + u.phone) {
              <tr class="border-t border-grey-50 hover:bg-grey-50 cursor-pointer" (click)="filterPhone(u.phone)">
                <td class="px-4 py-2">
                  <span class="flex items-center gap-1.5 font-medium text-grey-700">
                    <span class="w-2 h-2 rounded-full" [class]="u.connected ? 'bg-emerald-500' : 'bg-grey-200'" [title]="u.connected ? 'Conectado' : 'Desconectado'"></span>
                    {{ u.user_name || ('+' + u.phone) }}
                  </span>
                  <span class="block text-xs text-grey-400">
                    {{ u.tenant_name ?? '#' + u.tenant_id }} · {{ u.plan_name ?? '—' }} · +{{ u.phone }}
                  </span>
                </td>
                <td class="px-2 py-2">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="level(u).cls">{{ level(u).label }}</span>
                  @if (u.errors_7d) { <span class="ml-1 text-xs text-red-500" title="Errores en 7 días">⚠ {{ u.errors_7d }}</span> }
                </td>
                <td class="px-2 py-2 text-right font-medium text-grey-700">{{ u.messages_7d }}</td>
                <td class="px-2 py-2 text-right">{{ u.messages_30d }}</td>
                <td class="px-2 py-2 text-right">{{ u.messages_total }}</td>
                <td class="px-2 py-2 text-right">{{ u.credits_30d }}</td>
                <td class="px-2 py-2 text-right">{{ u.credits_total }}</td>
                <td class="px-2 py-2 text-right">\${{ u.cost_total | number: '1.2-2' }}</td>
                <td class="px-2 py-2 text-right" [class.text-red-500]="u.credit_balance != null && u.credit_balance <= 20">{{ u.credit_balance ?? '—' }}</td>
                <td class="px-4 py-2 text-right text-grey-400">
                  {{ u.last_at ? (u.last_at | date: 'd MMM, HH:mm') : 'Nunca' }}
                  <span class="block text-[11px]">{{ u.linked_at ? 'conectó ' + (u.linked_at | date: 'd MMM') : 'desconectado' }}</span>
                </td>
              </tr>
              } @empty {
              <tr><td colspan="10" class="px-4 py-6 text-center text-grey-400">Nadie en esta vista</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="px-4 py-2 border-t border-grey-50 text-[11px] text-grey-400">
          Nivel por mensajes en 7 días: Alto 20+, Medio 5–19, Bajo 1–4; Inactivo = lo usó antes pero no esta semana. Costo IA estimado con precios de Sonnet 5.5. Toca una fila para ver su conversación.
        </p>
      </section>

      <!-- Registro -->
      <section id="wa-log" class="bg-white rounded-xl border border-grey-50 flex flex-col min-h-[36rem] shrink-0">
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
        <div class="flex-1 wa-chat px-4 py-4 flex flex-col gap-2">
          @if (hasMore()) {
          <button type="button" (click)="loadOlder()" class="self-center rounded-full bg-white px-3 py-1 text-xs font-medium text-grey-600 shadow-sm cursor-pointer">Ver anteriores</button>
          }
          @for (m of messages(); track m.id) {
          @if (m.role === 'system') {
          <div class="self-center max-w-[90%] flex flex-col items-center gap-1">
            <span class="text-center rounded-md px-2.5 py-1 text-[11px] shadow-sm" [class]="m.debug?.error ? 'bg-red-50 text-red-600' : 'wa-note'">
              {{ m.body }} · +{{ m.phone }} · {{ m.created_at | date: 'd MMM HH:mm:ss' }}
            </span>
            @if (m.debug?.error) {
            <pre class="max-w-full overflow-x-auto rounded-md bg-white p-2 text-[10px] text-red-600 whitespace-pre-wrap">{{ m.debug?.error }}
{{ m.debug?.stack }}</pre>
            }
          </div>
          } @else {
          <div class="max-w-[85%] rounded-lg px-3 py-2 shadow-sm text-[13px] text-grey-700"
            [class]="m.role === 'user' ? 'self-end rounded-tr-none wa-bubble-user' : 'self-start rounded-tl-none bg-white'">
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
    const credits = days.reduce((a, d) => a + (d.credits ?? 0), 0);
    const cost = days.reduce((a, d) => a + Number(d.cost_usd), 0);
    return { messages, credits, cost, perMsg: messages ? cost / messages : 0 };
  });

  protected readonly views: { key: UserView; label: string }[] = [
    { key: 'recent', label: 'Recientes' },
    { key: 'top', label: 'Más uso' },
    { key: 'connected', label: 'Conectados' },
    { key: 'unused', label: 'Sin usar' },
    { key: 'all', label: 'Todos' },
  ];
  protected readonly view = signal<UserView>('recent');

  private readonly users = computed(() => this.stats()?.users ?? []);

  protected readonly summary = computed(() => {
    const users = this.users();
    return {
      users: users.length,
      connected: users.filter((u) => u.connected).length,
      neverUsed: users.filter((u) => u.connected && !u.messages_total).length,
      active7: users.filter((u) => u.messages_7d > 0).length,
    };
  });

  private readonly byView = computed<Record<UserView, WaBotUserRow[]>>(() => {
    const users = this.users();
    const recent = users.filter((u) => u.last_at).sort((a, b) => (b.last_at ?? '').localeCompare(a.last_at ?? ''));
    return {
      recent,
      top: [...users].filter((u) => u.messages_total).sort((a, b) => b.credits_total - a.credits_total || b.messages_total - a.messages_total),
      connected: users.filter((u) => u.connected),
      unused: users.filter((u) => u.connected && !u.messages_total),
      all: users,
    };
  });

  protected readonly visibleUsers = computed(() => this.byView()[this.view()]);
  protected readonly counts = computed(() => {
    const v = this.byView();
    return { recent: v.recent.length, top: v.top.length, connected: v.connected.length, unused: v.unused.length, all: v.all.length };
  });

  /** Nivel de uso por mensajes en los últimos 7 días. */
  protected level(u: WaBotUserRow): { label: string; cls: string } {
    if (u.messages_7d >= 20) return { label: 'Alto', cls: 'bg-emerald-50 text-emerald-600' };
    if (u.messages_7d >= 5) return { label: 'Medio', cls: 'bg-sky-50 text-sky-600' };
    if (u.messages_7d >= 1) return { label: 'Bajo', cls: 'bg-amber-50 text-amber-600' };
    if (u.messages_total) return { label: 'Inactivo', cls: 'bg-grey-50 text-grey-500' };
    return { label: 'Sin usar', cls: 'bg-grey-50 text-grey-400' };
  }

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

  protected async filterPhone(phone: string): Promise<void> {
    this.phoneFilter.set(phone);
    this.tenantFilter.set(null);
    await this.load();
    document.getElementById('wa-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected clearFilter(): void {
    this.tenantFilter.set(null);
    this.phoneFilter.set(null);
    this.load();
  }
}

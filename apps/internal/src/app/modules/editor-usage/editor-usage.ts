import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ButtonComponent, IconComponent } from '@ui';
import { EditorUsageData, EditorUsageService, EditorUsageStore } from './editor-usage.service';

/** Nombres legibles de los valores guardados en design.look. */
const LABELS: Record<string, Record<string, string>> = {
  theme: {
    claro: 'Claro', mineral: 'Mineral', arena: 'Arena', algodon: 'Algodón', atardecer: 'Atardecer',
    crepusculo: 'Crepúsculo', electrico: 'Eléctrico', bloque: 'Bloque', cuadricula: 'Cuadrícula',
    jade: 'Jade', lago: 'Lago', carbon: 'Carbón', '(sin dato)': 'Sin tema (personalizado)',
  },
  bgType: { fill: 'Color', gradient: 'Degradado', blur: 'Desenfoque', pattern: 'Patrón', image: 'Imagen', video: 'Video' },
  buttonStyle: { solid: 'Relleno', outline: 'Borde', soft: 'Suave' },
  buttonShape: { square: 'Recto', rounded: 'Redondeado', pill: 'Píldora' },
  productLayout: { grid2: '2 columnas', grid3: '3 columnas', grid4: '4 columnas', list: 'Lista' },
  categoryStyle: { chips: 'Chips', tabs: 'Pestañas', icons: 'Íconos' },
  cardStyle: { filled: 'Rellena', flat: 'Plana', border: 'Con borde' },
};

const GROUPS: { option: string; title: string; icon: string }[] = [
  { option: 'theme', title: 'Temas', icon: 'sparkles' },
  { option: 'font', title: 'Fuentes', icon: 'type' },
  { option: 'bgType', title: 'Fondo', icon: 'image' },
  { option: 'buttonStyle', title: 'Botones', icon: 'mouse-pointer-click' },
  { option: 'productLayout', title: 'Vista de productos', icon: 'layout-grid' },
  { option: 'categoryStyle', title: 'Categorías', icon: 'tag' },
];

/**
 * Panel interno → Uso del editor. Cuántas tiendas guardaron su catálogo con el
 * editor de diseño nuevo (design.look), qué temas y opciones eligen y cuándo.
 * Sin catálogos demo.
 */
@Component({
  selector: 'app-editor-usage',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ButtonComponent, IconComponent],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0 overflow-y-auto p-1 pb-8">
      <header class="flex flex-wrap items-end justify-between gap-3 shrink-0">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-bold text-grey-700">Uso del editor de catálogo</h1>
          <p class="text-sm text-grey-400 max-w-2xl">
            Tiendas que guardaron su diseño con el editor nuevo (temas, fondo, fuentes, botones). Sin catálogos demo.
          </p>
        </div>
        <ui-button label="Refrescar" icon="refresh-cw" variant="outlined" [fluid]="false" [isLoading]="isLoading()" (click)="load()" />
      </header>

      @if (error(); as err) {
      <div class="eu-card text-sm text-red-500">No se pudieron cargar las métricas: {{ err }}</div>
      } @else if (data(); as d) {
      <!-- KPIs -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <article class="eu-card eu-kpi" data-testid="kpi-using">
          <span class="eu-kpi-label"><ui-icon name="store" size="15" /> Tiendas que lo usan</span>
          <strong>{{ d.using }}</strong>
          <small>{{ pct(d.using, d.total_stores) }} de {{ d.total_stores | number }} tiendas</small>
        </article>
        <article class="eu-card eu-kpi" data-testid="kpi-theme">
          <span class="eu-kpi-label"><ui-icon name="sparkles" size="15" /> Eligieron un tema</span>
          <strong>{{ d.with_theme }}</strong>
          <small>{{ pct(d.with_theme, d.using) }} de las que lo usan</small>
        </article>
        <article class="eu-card eu-kpi" data-testid="kpi-paid">
          <span class="eu-kpi-label"><ui-icon name="crown" size="15" /> Con plan pago</span>
          <strong>{{ d.using_paid }}</strong>
          <small>{{ pct(d.using_paid, d.paid_stores) }} de {{ d.paid_stores | number }} tiendas pagas</small>
        </article>
        <article class="eu-card eu-kpi" data-testid="kpi-week">
          <span class="eu-kpi-label"><ui-icon name="calendar" size="15" /> Guardaron esta semana</span>
          <strong>{{ d.last_7_days }}</strong>
          <small>últimos 7 días</small>
        </article>
      </section>

      <!-- Por día -->
      <section class="eu-card shrink-0">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="eu-h2">Último guardado por día</h2>
          <span class="text-xs text-grey-400">Últimos 30 días · cada tienda cuenta el día de su último guardado</span>
        </div>
        <div class="eu-chart" role="img" [attr.aria-label]="chartLabel()">
          <div class="eu-chart-grid">
            <span>{{ maxDaily() }}</span>
            <span>0</span>
          </div>
          <div class="eu-bars">
            @for (p of d.daily; track p.day) {
            <div class="eu-bar-slot" tabindex="0" [attr.aria-label]="(p.day | date: 'd MMM') + ': ' + p.stores">
              <div class="eu-bar" [style.height.%]="(p.stores / maxDaily()) * 100" [class.is-zero]="!p.stores"></div>
              <span class="eu-tip">{{ p.day | date: 'EEE d MMM' }}<b>{{ p.stores }} {{ p.stores === 1 ? 'tienda' : 'tiendas' }}</b></span>
            </div>
            }
          </div>
          <div class="eu-axis">
            <span>{{ d.daily[0]?.day | date: 'd MMM' }}</span>
            <span>Hoy</span>
          </div>
        </div>
      </section>

      <!-- Opciones -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 shrink-0">
        @for (g of groups(); track g.option) {
        <article class="eu-card" [attr.data-testid]="'group-' + g.option">
          <h2 class="eu-h2"><ui-icon [name]="g.icon" size="16" /> {{ g.title }}</h2>
          @if (g.rows.length) {
          <ul class="flex flex-col gap-2.5">
            @for (r of g.rows; track r.value) {
            <li class="eu-row">
              <div class="flex justify-between gap-2 text-sm">
                <span class="text-grey-600 truncate">{{ r.label }}</span>
                <span class="text-grey-700 font-semibold tabular-nums">{{ r.stores }} <small class="text-grey-400 font-normal">· {{ pct(r.stores, d.using) }}</small></span>
              </div>
              <div class="eu-track"><div class="eu-fill" [style.width.%]="(r.stores / d.using) * 100"></div></div>
            </li>
            }
          </ul>
          } @else {
          <p class="text-sm text-grey-400">Sin datos todavía.</p>
          }
        </article>
        }
      </section>

      <!-- Tiendas -->
      <section class="eu-card shrink-0">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="eu-h2">Tiendas ({{ filteredStores().length }})</h2>
          <div class="flex gap-2">
            <button type="button" class="eu-chip" [class.is-active]="filter() === 'all'" (click)="filter.set('all')">Todas</button>
            <button type="button" class="eu-chip" [class.is-active]="filter() === 'theme'" (click)="filter.set('theme')">Con tema</button>
            <button type="button" class="eu-chip" [class.is-active]="filter() === 'paid'" (click)="filter.set('paid')">Plan pago</button>
          </div>
        </div>
        <div class="overflow-x-auto -mx-1">
          <table class="eu-table">
            <thead>
              <tr><th>Tienda</th><th>Plan</th><th>Tema</th><th>Fuente</th><th>Fondo</th><th>Último guardado</th></tr>
            </thead>
            <tbody>
              @for (s of filteredStores(); track s.tenant_id) {
              <tr>
                <td>
                  <a class="font-semibold text-grey-700 hover:underline" [href]="'https://' + s.slug + '.catalogohoy.com'" target="_blank" rel="noopener">{{ s.name }}</a>
                  <div class="text-xs text-grey-400">#{{ s.tenant_id }} · {{ s.slug }}</div>
                </td>
                <td><span class="eu-badge" [class.eu-badge--paid]="!s.is_free">{{ s.plan }}</span></td>
                <td>{{ label('theme', s.theme) }}</td>
                <td>{{ s.font || '—' }}</td>
                <td>{{ label('bgType', s.bg_type) }}</td>
                <td class="whitespace-nowrap text-grey-500">{{ s.saved_at ? (s.saved_at | date: 'd MMM, h:mm a') : '—' }}</td>
              </tr>
              } @empty {
              <tr><td colspan="6" class="text-center text-grey-400 py-6">Ninguna tienda en este filtro.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      } @else {
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        @for (i of [1, 2, 3, 4]; track i) { <div class="eu-skeleton"></div> }
      </section>
      }
    </div>
  `,
  styles: `
    .eu-card { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; background: var(--color-white, #fff); border: 0.0625rem solid var(--color-grey-100); border-radius: 0.875rem; }
    .eu-h2 { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; font-weight: 700; color: var(--color-grey-700); }
    .eu-kpi { gap: 0.35rem; }
    .eu-kpi-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--color-grey-500); }
    .eu-kpi strong { font-size: 2rem; line-height: 1.1; font-weight: 700; color: var(--color-grey-800); font-variant-numeric: tabular-nums; }
    .eu-kpi small { font-size: 0.75rem; color: var(--color-grey-400); }
    .eu-skeleton { height: 7rem; border-radius: 0.875rem; background: var(--color-grey-50); animation: eu-pulse 1.2s ease-in-out infinite; }
    @keyframes eu-pulse { 50% { opacity: 0.5; } }

    .eu-chart { display: grid; grid-template-columns: auto 1fr; grid-template-rows: 10rem auto; column-gap: 0.5rem; }
    .eu-chart-grid { display: flex; flex-direction: column; justify-content: space-between; font-size: 0.7rem; color: var(--color-grey-400); text-align: right; }
    .eu-bars { display: flex; align-items: flex-end; gap: 2px; border-bottom: 0.0625rem solid var(--color-grey-100); background: linear-gradient(var(--color-grey-50) 0.0625rem, transparent 0.0625rem) top / 100% 50%; }
    .eu-bar-slot { position: relative; flex: 1; height: 100%; display: flex; align-items: flex-end; outline: none; }
    .eu-bar-slot:hover, .eu-bar-slot:focus-visible { background: color-mix(in srgb, var(--color-grey-200) 35%, transparent); }
    .eu-bar { width: 100%; min-height: 0; background: var(--color-primary-500); border-radius: 4px 4px 0 0; }
    .eu-bar.is-zero { height: 0 !important; }
    .eu-tip { position: absolute; bottom: calc(100% + 0.25rem); left: 50%; transform: translateX(-50%); display: none; flex-direction: column; padding: 0.4rem 0.6rem; font-size: 0.72rem; white-space: nowrap; color: var(--color-grey-500); background: var(--color-white, #fff); border: 0.0625rem solid var(--color-grey-100); border-radius: 0.5rem; box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.12); z-index: 2; pointer-events: none; }
    .eu-tip b { color: var(--color-grey-700); font-size: 0.8rem; }
    .eu-bar-slot:hover .eu-tip, .eu-bar-slot:focus-visible .eu-tip { display: flex; }
    .eu-axis { grid-column: 2; display: flex; justify-content: space-between; padding-top: 0.35rem; font-size: 0.7rem; color: var(--color-grey-400); }

    .eu-row { display: flex; flex-direction: column; gap: 0.3rem; }
    .eu-track { height: 0.4rem; border-radius: 999px; background: var(--color-grey-50); overflow: hidden; }
    .eu-fill { height: 100%; border-radius: 999px; background: var(--color-primary-500); }

    .eu-chip { padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; color: var(--color-grey-500); border: 0.0625rem solid var(--color-grey-100); border-radius: 999px; }
    .eu-chip.is-active { color: var(--color-primary-600); border-color: var(--color-primary-500); background: color-mix(in srgb, var(--color-primary-500) 8%, transparent); }

    .eu-table { width: 100%; min-width: 44rem; font-size: 0.85rem; border-collapse: collapse; }
    .eu-table th { text-align: left; padding: 0.6rem 0.75rem; font-size: 0.72rem; font-weight: 600; color: var(--color-grey-400); text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 0.0625rem solid var(--color-grey-100); }
    .eu-table td { padding: 0.65rem 0.75rem; color: var(--color-grey-600); border-bottom: 0.0625rem solid var(--color-grey-50); vertical-align: middle; }
    .eu-badge { display: inline-block; padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 700; border-radius: 999px; color: var(--color-grey-500); background: var(--color-grey-50); }
    .eu-badge--paid { color: #b45309; background: #fef3c7; }
  `,
})
export class EditorUsage implements OnInit {
  private readonly service = inject(EditorUsageService);

  readonly data = signal<EditorUsageData | null>(null);
  readonly error = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly filter = signal<'all' | 'theme' | 'paid'>('all');

  readonly maxDaily = computed(() => Math.max(1, ...(this.data()?.daily ?? []).map((p) => p.stores)));

  readonly chartLabel = computed(() => {
    const total = (this.data()?.daily ?? []).reduce((a, p) => a + p.stores, 0);
    return `Tiendas por día de último guardado, últimos 30 días: ${total} en total`;
  });

  readonly groups = computed(() => {
    const d = this.data();
    if (!d) return [];
    return GROUPS.map((g) => ({
      ...g,
      rows: d.options
        .filter((o) => o.option === g.option)
        .sort((a, b) => b.stores - a.stores)
        .map((o) => ({ value: o.value, stores: o.stores, label: this.label(g.option, o.value) })),
    }));
  });

  readonly filteredStores = computed<EditorUsageStore[]>(() => {
    const list = this.data()?.stores ?? [];
    const f = this.filter();
    return f === 'theme' ? list.filter((s) => !!s.theme) : f === 'paid' ? list.filter((s) => !s.is_free) : list;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    const result = await this.service.get();
    result
      .mapRight((d) => {
        this.error.set(null);
        this.data.set(d);
      })
      .mapLeft((e) => this.error.set(e.message));
    this.isLoading.set(false);
  }

  label(option: string, value: string | null): string {
    if (!value) return option === 'theme' ? 'Sin tema' : '—';
    return LABELS[option]?.[value] ?? (value === '(sin dato)' ? 'Sin dato' : value);
  }

  pct(n: number, total: number): string {
    if (!total) return '0%';
    const p = (n / total) * 100;
    return `${p < 1 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;
  }
}

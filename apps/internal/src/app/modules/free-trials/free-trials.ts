import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '@ui';
import { tierLabel } from '../shared/plan-cycle.model';
import { FreeTrial, FreeTrialsService } from './free-trials.service';

/**
 * Vista interna "Free trials": lista los tenants en prueba de 7 días
 * (stripe_subscription_status = 'trialing'), ordenados por el que vence primero.
 * Cada fila lleva al detalle del catálogo (/tenants/:id). Datos vía RPC
 * `list_trialing_tenants_admin` (gateado por _assert_internal_admin).
 */
@Component({
  selector: 'app-free-trials',
  standalone: true,
  imports: [IconComponent, DatePipe],
  host: { class: 'flex-1 flex flex-col min-h-0 gap-4' },
  template: `
    <!-- Header -->
    <header class="shrink-0">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-grey-700">Free trials</h1>
          <p class="text-sm text-grey-400 mt-0.5">
            Catálogos probando 7 días gratis un plan pago. Se cobran al vencer si no cancelan.
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-grey-100 text-sm font-medium text-grey-600 hover:bg-grey-50 transition-colors cursor-pointer disabled:opacity-60"
          [disabled]="isLoading()"
          (click)="load()"
        >
          <ui-icon name="refresh-cw" size="15" [styleClass]="isLoading() ? 'animate-spin' : ''" />
          Recargar
        </button>
      </div>
    </header>

    <!-- KPIs -->
    <section class="grid grid-cols-2 sm:grid-cols-3 gap-4 shrink-0">
      <article class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-50">
          <ui-icon name="gift" size="18" styleClass="text-violet-500" />
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-grey-400">Trials activos</span>
          <strong class="text-xl font-bold text-grey-700">{{ total() }}</strong>
        </div>
      </article>
      <article class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50">
          <ui-icon name="clock" size="18" styleClass="text-amber-500" />
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-grey-400">Vencen en ≤2 días</span>
          <strong class="text-xl font-bold text-grey-700">{{ expiringSoon() }}</strong>
        </div>
      </article>
    </section>

    <!-- Tabla -->
    <section class="flex-1 min-h-0 bg-white rounded-xl border border-grey-50 overflow-hidden flex flex-col">
      <div class="overflow-auto">
        <table class="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              @for (h of ['Comercio', 'Dueño', 'Plan', 'Empezó', 'Vence', 'Restan']; track h) {
              <th class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100">
                {{ h }}
              </th>
              }
            </tr>
          </thead>
          <tbody>
            @if (isLoading()) {
            <tr><td colspan="6" class="px-4 py-10 text-center text-grey-400">Cargando…</td></tr>
            } @else if (error()) {
            <tr><td colspan="6" class="px-4 py-10 text-center text-red-500">{{ error() }}</td></tr>
            } @else {
            @for (t of trials(); track t.tenantId) {
            <tr class="hover:bg-grey-25 cursor-pointer transition-colors" (click)="openDetail(t)">
              <td class="px-4 py-3 border-b border-grey-50">
                <div class="flex items-center gap-3">
                  @if (t.tenantLogo && !brokenLogos().has(t.tenantId)) {
                  <img
                    [src]="t.tenantLogo"
                    [alt]="t.tenantName ?? ''"
                    class="w-9 h-9 rounded-lg object-cover shrink-0"
                    (error)="markBroken(t.tenantId)"
                  />
                  } @else {
                  <div class="w-9 h-9 rounded-lg bg-violet-500 text-white flex items-center justify-center font-semibold shrink-0">
                    {{ initial(t) }}
                  </div>
                  }
                  <div class="flex flex-col min-w-0">
                    <strong class="font-semibold text-grey-700 truncate">{{ t.tenantName ?? 'Sin nombre' }}</strong>
                    @if (t.tenantSlug) {
                    <span class="text-xs text-grey-400 truncate">{{ t.tenantSlug }}.catalogohoy.com</span>
                    }
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 border-b border-grey-50">
                <div class="flex flex-col min-w-0">
                  <span class="text-grey-700 truncate">{{ t.ownerName || '—' }}</span>
                  @if (t.ownerEmail) {
                  <span class="text-xs text-grey-400 truncate">{{ t.ownerEmail }}</span>
                  }
                </div>
              </td>
              <td class="px-4 py-3 border-b border-grey-50">
                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-primary-50 text-primary-600">
                  {{ tierLabel(t.tier) }}
                </span>
              </td>
              <td class="px-4 py-3 border-b border-grey-50 text-grey-500 whitespace-nowrap">
                {{ t.startedAt ? (t.startedAt | date: 'd MMM') : '—' }}
              </td>
              <td class="px-4 py-3 border-b border-grey-50 text-grey-600 whitespace-nowrap">
                {{ t.expiresAt ? (t.expiresAt | date: 'd MMM y') : '—' }}
              </td>
              <td class="px-4 py-3 border-b border-grey-50 whitespace-nowrap">
                <span
                  class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                  [class]="daysChipClass(t.daysUntilExpiry)"
                >
                  {{ daysLabel(t.daysUntilExpiry) }}
                </span>
              </td>
            </tr>
            } @empty {
            <tr>
              <td colspan="6" class="px-4 py-14 text-center">
                <div class="flex flex-col items-center gap-2 text-grey-400">
                  <ui-icon name="gift" size="28" styleClass="text-grey-200" />
                  <span>No hay free trials activos en este momento.</span>
                </div>
              </td>
            </tr>
            }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class FreeTrials implements OnInit {
  private readonly service = inject(FreeTrialsService);
  private readonly router = inject(Router);

  public readonly trials = signal<FreeTrial[]>([]);
  public readonly isLoading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly brokenLogos = signal<Set<number>>(new Set());

  public readonly total = computed(() => this.trials().length);
  public readonly expiringSoon = computed(
    () =>
      this.trials().filter(
        (t) => t.daysUntilExpiry !== null && t.daysUntilExpiry <= 2
      ).length
  );

  public readonly tierLabel = tierLabel;

  ngOnInit(): void {
    this.load();
  }

  public async load(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    const res = await this.service.list();
    res
      .mapRight((rows) => this.trials.set(rows))
      .mapLeft((e) => this.error.set(e.message));
    this.isLoading.set(false);
  }

  public openDetail(t: FreeTrial): void {
    this.router.navigate(['/tenants', t.tenantId]);
  }

  public markBroken(id: number): void {
    this.brokenLogos.update((s) => new Set(s).add(id));
  }

  public initial(t: FreeTrial): string {
    return (t.tenantName ?? t.tenantSlug ?? '?').charAt(0).toUpperCase();
  }

  public daysLabel(days: number | null): string {
    if (days === null) return '—';
    if (days <= 0) return 'Vence hoy';
    if (days === 1) return '1 día';
    return `${days} días`;
  }

  public daysChipClass(days: number | null): string {
    if (days === null) return 'bg-grey-100 text-grey-500';
    if (days <= 1) return 'bg-red-50 text-red-600';
    if (days <= 2) return 'bg-amber-50 text-amber-600';
    return 'bg-violet-50 text-violet-600';
  }
}

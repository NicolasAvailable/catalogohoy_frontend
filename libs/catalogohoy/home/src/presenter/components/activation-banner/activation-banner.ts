import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  EcommerceConfigService,
  EcommerceConfigStore,
} from '@catalogohoy/ecommerce-config';
import { PlanStore } from '@catalogohoy/plan';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { IconComponent } from '@ui';
import {
  activationDone,
  buildActivationSteps,
  firstPendingStep,
  isHomeUrl,
} from './activation-steps';

/**
 * Banner de activación in-app (CAT-73): barra slim y descartable que empuja el
 * PRÓXIMO paso no completado en TODO el admin — no solo en el Inicio. Reusa el
 * mismo estado de hitos que `getting-started` (producto / personalizar /
 * vendedores WhatsApp), derivado del estado real del catálogo, sin tabla ni
 * flags nuevos.
 *
 * Alcance: cualquiera que loguee (no depende de abrir un email ni de visitar
 * Inicio). Costo: $0 (in-app). Es la contraparte gratuita de la secuencia de
 * activación por email (send-activation-nudges).
 *
 *   - Solo el owner (los miembros no configuran el catálogo).
 *   - Se oculta en el Inicio (ahí ya está el checklist completo).
 *   - Descartable por sesión (sessionStorage): vuelve a aparecer al próximo
 *     login mientras el catálogo siga sin activar → nudge gentil y recurrente.
 *   - Fast-path: si el checklist ya se completó antes (cache localStorage del
 *     Inicio), no consulta nada ni se muestra.
 */
@Component({
  selector: 'app-activation-banner',
  standalone: true,
  imports: [IconComponent, TranslocoPipe],
  template: `
    @if (visible()) {
    <div class="activation-banner">
      <div class="activation-banner__content">
        <div class="activation-banner__text">
          <ui-icon
            [name]="firstPending()!.icon"
            [size]="18"
            class="activation-banner__icon"
          />
          <span class="activation-banner__msg">
            <strong>{{ 'Siguiente paso' | transloco }}:</strong>
            {{ firstPending()!.title | transloco }}
            <span class="activation-banner__hint">
              — {{ firstPending()!.hint | transloco }}</span
            >
          </span>
        </div>
        <div class="activation-banner__actions">
          <button class="activation-banner__cta" (click)="go()">
            {{ firstPending()!.ctaLabel | transloco }}
          </button>
          <button
            class="activation-banner__close"
            (click)="dismiss()"
            [attr.aria-label]="'Cerrar' | transloco"
          >
            <ui-icon name="x" [size]="16" />
          </button>
        </div>
      </div>
    </div>
    }
  `,
  styles: `
    .activation-banner {
      background: #2563eb;
      color: white;
      z-index: 40;
      flex-shrink: 0;
    }

    .activation-banner__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.625rem 1.5rem;
    }

    .activation-banner__text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      min-width: 0;
    }

    .activation-banner__icon {
      flex-shrink: 0;
    }

    .activation-banner__msg {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .activation-banner__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .activation-banner__cta {
      background: white;
      color: #2563eb;
      border: none;
      border-radius: 0.375rem;
      padding: 0.375rem 1rem;
      font-size: 0.8125rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s;
    }

    .activation-banner__cta:hover {
      background: #eff6ff;
    }

    .activation-banner__close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      opacity: 0.7;
      display: flex;
      align-items: center;
      padding: 0.25rem;
      transition: opacity 0.2s;
    }

    .activation-banner__close:hover {
      opacity: 1;
    }

    @media (max-width: 640px) {
      .activation-banner__content {
        padding: 0.5rem 1rem;
      }
      .activation-banner__hint {
        display: none;
      }
    }
  `,
})
export class ActivationBanner implements OnInit {
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly configService = inject(EcommerceConfigService);
  private readonly planStore = inject(PlanStore);
  private readonly permissions = inject(TeamPermissionsStore);

  private readonly loaded = signal(false);
  /** Checklist completado en una visita anterior (cache por tenant): fast-path
   *  compartido con el checklist del Inicio → no se muestra ni consulta. */
  private readonly completedCached = signal(false);
  private readonly dismissed = signal(false);
  private readonly notifyNumber = signal<string | null>(null);
  private tenantId: string | null = null;

  /** URL actual (reactiva) para ocultar el banner en el Inicio. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  private readonly isHome = computed(() => isHomeUrl(this.url()));

  /** Mismos hitos que `getting-started` (lógica pura en activation-steps). El
   *  paso "avisos WhatsApp" queda locked en gratis → no es meta de activación
   *  y no lo mostramos como próximo paso. */
  private readonly steps = computed(() => {
    const config = this.configStore.config();
    const usage = this.planStore.tenantPlanUsage();
    return buildActivationSteps({
      productCount: usage?.currentProductCount ?? 0,
      hasCustomize: !!(
        config?.logo ||
        config?.banner ||
        (config?.description ?? '').trim()
      ),
      sellerCount: config?.whatsappButtons?.length ?? 0,
      notifyNumber: this.notifyNumber(),
      isFree: this.planStore.isFreePlan(),
    });
  });

  /** Próximo paso pendiente (mismo criterio que el checklist del Inicio). */
  public readonly firstPending = computed(() => firstPendingStep(this.steps()));

  public readonly visible = computed(
    () =>
      this.loaded() &&
      !this.completedCached() &&
      !this.dismissed() &&
      !this.isHome() &&
      this.permissions.isOwner() &&
      !!this.firstPending()
  );

  async ngOnInit(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    const id = String(tenantId);
    this.tenantId = id;

    // Descartado en esta sesión → no se muestra hasta el próximo login.
    try {
      if (sessionStorage.getItem(this.dismissKey(id)) === '1') {
        this.dismissed.set(true);
        return;
      }
    } catch {
      /* sin sessionStorage → seguimos */
    }

    // Fast-path: checklist ya completado antes (cache del Inicio) → nada.
    try {
      if (localStorage.getItem(this.doneKey(id)) === '1') {
        this.completedCached.set(true);
        return;
      }
    } catch {
      /* sin localStorage → camino normal */
    }

    // Solo el owner configura el catálogo: para el resto ni consultamos.
    if (!this.permissions.isOwner()) return;

    // Esperamos el conteo de productos ANTES de mostrar nada: si no, arranca
    // en 0 y el banner titilaría "Crea tu primer producto" en un catálogo ya
    // activado (y no llegaría a cachear "completado"). Un fallo transitorio de
    // red no debe romper el shell ni disparar telemetría: solo no mostramos el
    // nudge esta vez.
    try {
      await Promise.all([
        this.planStore.loadTenantPlanUsage(),
        this.configStore.loadConfig(id),
      ]);
      const notify = await this.configService.getWhatsappNotifySettings(id);
      notify.mapRight((s) => this.notifyNumber.set(s.recipientNumber));
    } catch {
      return;
    }
    this.loaded.set(true);

    // Ya está todo hecho → se cachea igual que el checklist del Inicio.
    if (activationDone(this.steps())) {
      try {
        localStorage.setItem(this.doneKey(id), '1');
      } catch {
        /* noop */
      }
    }
  }

  public go(): void {
    const step = this.firstPending();
    if (!step) return;
    void this.router.navigate([step.link], {
      queryParams: step.queryParams ?? undefined,
    });
  }

  public dismiss(): void {
    this.dismissed.set(true);
    if (!this.tenantId) return;
    try {
      sessionStorage.setItem(this.dismissKey(this.tenantId), '1');
    } catch {
      /* noop */
    }
  }

  private doneKey(tenantId: string): string {
    return `home_checklist_done_${tenantId}`;
  }

  private dismissKey(tenantId: string): string {
    return `activation_banner_dismissed_${tenantId}`;
  }
}

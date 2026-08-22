import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  EcommerceConfigService,
  EcommerceConfigStore,
} from '@catalogohoy/ecommerce-config';
import { PlanStore } from '@catalogohoy/plan';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, IconComponent } from '@ui';

/** Un paso del checklist de primeros pasos del Inicio. Los textos van en
 *  español porque las keys de transloco SON el texto (KEY-AS-TEXT). */
interface ChecklistStep {
  id: string;
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
  queryParams: Record<string, string> | null;
  done: boolean;
  /** Paso exclusivo de planes pagos: al plan gratis se le muestra como
   *  upsell (candado + CTA a Planes) y no bloquea completar el checklist. */
  locked: boolean;
}

/**
 * Checklist de primeros pasos ("¡Revisa los pasos para dejar tu catálogo
 * listo para vender!") del Inicio. Reemplaza al onboarding guiado: cada paso
 * se marca solo, derivado del estado real del catálogo — sin tabla nueva ni
 * flags persistidos:
 *
 *   1. Primer producto      → conteo de productos del plan usage
 *   2. Personalizar         → logo/banner/descripción en la config
 *   3. Vendedores WhatsApp  → whatsapp_buttons de la config
 *   4. Avisos por WhatsApp  → recipient_number en notification_settings
 *                             (planes pagos; gratis lo ve como upsell)
 *
 * Solo lo ve el owner y se oculta solo cuando los pasos reales (no-locked)
 * están completos.
 */
@Component({
  selector: 'app-getting-started',
  standalone: true,
  imports: [ButtonComponent, IconComponent, TranslocoPipe],
  templateUrl: './getting-started.html',
})
export class GettingStarted implements OnInit {
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly configService = inject(EcommerceConfigService);
  private readonly planStore = inject(PlanStore);
  private readonly permissions = inject(TeamPermissionsStore);

  private readonly loaded = signal(false);
  /** Checklist ya completado en una visita anterior (cache por tenant en
   *  localStorage): fast-path que evita el skeleton y las consultas. */
  private readonly completedCached = signal(false);
  /** Número de avisos WhatsApp ya configurado (null = sin configurar). */
  private readonly notifyNumber = signal<string | null>(null);

  public readonly expanded = signal<string | null>(null);

  public readonly steps = computed<ChecklistStep[]>(() => {
    const config = this.configStore.config();
    const usage = this.planStore.tenantPlanUsage();
    const isFree = this.planStore.isFreePlan();
    return [
      {
        id: 'product',
        icon: 'package',
        title: 'Crea tu primer producto',
        description:
          'Sube tu primer producto con foto y precio para estrenar tu catálogo.',
        ctaLabel: 'Crear producto',
        link: '/admin/products',
        queryParams: null,
        done: (usage?.currentProductCount ?? 0) > 0,
        locked: false,
      },
      {
        id: 'customize',
        icon: 'palette',
        title: 'Personaliza tu catálogo',
        description:
          'Sube tu logo, agrega una descripción y elige los colores que representan tu negocio.',
        ctaLabel: 'Personalizar',
        link: '/admin/catalog/edit',
        queryParams: { tab: 'general' },
        done: !!(
          config?.logo ||
          config?.banner ||
          (config?.description ?? '').trim()
        ),
        locked: false,
      },
      {
        id: 'sellers',
        icon: 'message-circle',
        title: 'Agrega tus vendedores de WhatsApp',
        description:
          'Configura los números de WhatsApp que recibirán los pedidos del checkout.',
        ctaLabel: 'Agregar vendedores',
        link: '/admin/catalog/edit',
        queryParams: { tab: 'payments' },
        done: (config?.whatsappButtons?.length ?? 0) > 0,
        locked: false,
      },
      {
        id: 'notify',
        icon: 'smartphone',
        title: 'Activa los avisos de órdenes por WhatsApp',
        description:
          'Recibe un WhatsApp cada vez que entra una orden nueva, además del correo.',
        ctaLabel: isFree ? 'Ver planes' : 'Configurar avisos',
        link: isFree ? '/admin/plans' : '/admin/catalog/edit',
        queryParams: isFree ? null : { tab: 'notifications' },
        done: !!this.notifyNumber(),
        locked: isFree,
      },
    ];
  });

  /** Pasos que cuentan para ocultar el card (los locked son upsell, no meta). */
  private readonly countableSteps = computed(() =>
    this.steps().filter((s) => !s.locked)
  );

  /** Visible solo para el owner, con datos cargados y con algún paso real
   *  pendiente. */
  public readonly visible = computed(
    () =>
      this.loaded() &&
      !this.completedCached() &&
      this.permissions.isOwner() &&
      this.countableSteps().some((s) => !s.done)
  );

  /** Skeleton mientras cargan los datos del checklist (solo para el owner y
   *  solo si no sabemos ya que está completado). */
  public readonly isLoading = computed(
    () =>
      !this.loaded() && !this.completedCached() && this.permissions.isOwner()
  );

  async ngOnInit(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    const id = String(tenantId);

    // Fast-path: completado en una visita anterior → ni skeleton ni queries.
    try {
      if (localStorage.getItem(this.doneKey(id)) === '1') {
        this.completedCached.set(true);
        return;
      }
    } catch {
      /* sin localStorage → seguimos por el camino normal */
    }

    this.planStore.loadTenantPlanUsage();
    await this.configStore.loadConfig(id);
    const notify = await this.configService.getWhatsappNotifySettings(id);
    notify.mapRight((s) => this.notifyNumber.set(s.recipientNumber));
    this.loaded.set(true);

    // Completado: se cachea para que las próximas visitas no muestren nada.
    if (!this.countableSteps().some((s) => !s.done)) {
      try {
        localStorage.setItem(this.doneKey(id), '1');
      } catch {
        /* noop */
      }
      return;
    }

    // Abre el primer paso pendiente para que el CTA quede a la vista.
    const firstPending = this.steps().find((s) => !s.done && !s.locked);
    this.expanded.set(firstPending?.id ?? null);
  }

  private doneKey(tenantId: string): string {
    return `home_checklist_done_${tenantId}`;
  }

  public toggle(stepId: string): void {
    this.expanded.update((current) => (current === stepId ? null : stepId));
  }

  public go(step: ChecklistStep): void {
    void this.router.navigate([step.link], {
      queryParams: step.queryParams ?? undefined,
    });
  }
}

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { isAndroidApp } from '@catalogohoy/core';
import {
  EcommerceConfigService,
  EcommerceConfigStore,
} from '@catalogohoy/ecommerce-config';
import { PlanStore } from '@catalogohoy/plan';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, IconComponent } from '@ui';

/** Un hito del progreso del catálogo. A diferencia del checklist de primeros
 *  pasos (`getting-started`, que oculta lo hecho y desaparece al completarse),
 *  acá se CELEBRA lo hecho y se guía lo que falta — para seguir acompañando al
 *  usuario después del onboarding. Textos en español (KEY-AS-TEXT de transloco). */
interface ProgressStep {
  id: string;
  icon: string;
  /** Lo que hay que hacer (estado pendiente). */
  title: string;
  /** Felicitación cuando ya está hecho. */
  doneTitle: string;
  hint: string;
  /** CTA cuando falta hacerlo. */
  ctaLabel: string;
  /** CTA cuando ya está hecho (ir a revisarlo / gestionarlo). */
  viewLabel: string;
  link: string;
  queryParams: Record<string, string> | null;
  done: boolean;
  /** Hito de plan pago: al gratis se muestra como upsell (candado). */
  locked: boolean;
}

/**
 * "Tu progreso" en el Inicio: celebra los hitos logrados ("¡Ya creaste tu
 * primer producto!") con un botón para ir a esa sección, y guía los que
 * faltan. Complementa al onboarding: una vez dentro del admin, sigue
 * acompañando al usuario por la plataforma. Barra de progreso + descartable
 * (una vez todo listo, el owner puede cerrarlo). Solo lo ve el owner.
 */
@Component({
  selector: 'app-catalog-progress',
  standalone: true,
  imports: [ButtonComponent, IconComponent, TranslocoPipe],
  templateUrl: './catalog-progress.html',
})
export class CatalogProgress implements OnInit {
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly configService = inject(EcommerceConfigService);
  private readonly planStore = inject(PlanStore);
  private readonly permissions = inject(TeamPermissionsStore);

  private readonly loaded = signal(false);
  /** Descartado por el owner (cache por tenant): no se vuelve a mostrar. */
  private readonly dismissedCached = signal(false);
  private readonly notifyNumber = signal<string | null>(null);
  /** Cantidad de métodos de pago activos (para el hito de pagos). */
  private readonly activePaymentCount = signal(0);

  public readonly steps = computed<ProgressStep[]>(() => {
    const config = this.configStore.config();
    const usage = this.planStore.tenantPlanUsage();
    const isFree = this.planStore.isFreePlan();
    const activeShipping = (config?.shippingMethods ?? []).filter(
      (m) => m.isActive
    ).length;
    const steps: ProgressStep[] = [
      {
        id: 'product',
        icon: 'package',
        title: 'Crea tu primer producto',
        doneTitle: '¡Ya creaste tu primer producto!',
        hint: 'Súbelo con foto y precio para estrenar tu catálogo.',
        ctaLabel: 'Crear producto',
        viewLabel: 'Ver mis productos',
        link: '/admin/products',
        queryParams: null,
        done: (usage?.currentProductCount ?? 0) > 0,
        locked: false,
      },
      {
        id: 'customize',
        icon: 'palette',
        title: 'Personaliza tu catálogo',
        doneTitle: '¡Ya personalizaste tu catálogo!',
        hint: 'Sube tu logo, una descripción y tus colores de marca.',
        ctaLabel: 'Personalizar',
        viewLabel: 'Editar catálogo',
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
        doneTitle: '¡Ya configuraste tus vendedores de WhatsApp!',
        hint: 'Los números que reciben los pedidos del checkout.',
        ctaLabel: 'Agregar vendedores',
        viewLabel: 'Ver vendedores',
        link: '/admin/catalog/edit',
        queryParams: { tab: 'payments', section: 'whatsapp-sellers' },
        done: (config?.whatsappButtons?.length ?? 0) > 0,
        locked: false,
      },
      {
        id: 'payments',
        icon: 'banknote',
        title: 'Configura tus métodos de pago',
        doneTitle: '¡Ya configuraste tus métodos de pago!',
        hint: 'Transferencia, billeteras, efectivo… lo que aceptes.',
        ctaLabel: 'Configurar pagos',
        viewLabel: 'Ver métodos de pago',
        link: '/admin/catalog/edit',
        queryParams: { tab: 'payments' },
        done: this.activePaymentCount() > 0,
        locked: false,
      },
      {
        id: 'shipping',
        icon: 'truck',
        title: 'Configura tus entregas',
        doneTitle: '¡Ya configuraste tus entregas!',
        hint: 'Retiro en local, delivery o envío nacional.',
        ctaLabel: 'Configurar entregas',
        viewLabel: 'Ver entregas',
        link: '/admin/catalog/edit',
        queryParams: { tab: 'shipping' },
        done: activeShipping > 0,
        locked: false,
      },
      {
        id: 'notify',
        icon: 'smartphone',
        title: 'Activa los avisos de órdenes por WhatsApp',
        doneTitle: '¡Ya activaste los avisos por WhatsApp!',
        hint: 'Un WhatsApp cada vez que entra una orden nueva.',
        ctaLabel: isFree ? 'Ver planes' : 'Configurar avisos',
        viewLabel: isFree ? 'Ver planes' : 'Ver avisos',
        link: isFree ? '/admin/plans' : '/admin/catalog/edit',
        queryParams: isFree ? null : { tab: 'notifications' },
        done: !!this.notifyNumber(),
        locked: isFree,
      },
    ];
    // En la app nativa no se muestran hitos "locked" (son upsell a un plan pago
    // con link a /admin/plans → compra externa): Apple 3.1.1. El hito de avisos
    // sigue visible para quien ya tiene plan pago (ahí locked=false).
    return isAndroidApp() ? steps.filter((s) => !s.locked) : steps;
  });

  /** Hitos que cuentan para el progreso (los locked son upsell, no meta). */
  private readonly countableSteps = computed(() =>
    this.steps().filter((s) => !s.locked)
  );
  public readonly doneCount = computed(
    () => this.countableSteps().filter((s) => s.done).length
  );
  public readonly totalCount = computed(() => this.countableSteps().length);
  public readonly allDone = computed(
    () => this.totalCount() > 0 && this.doneCount() === this.totalCount()
  );
  public readonly progressPct = computed(() =>
    this.totalCount() ? Math.round((this.doneCount() / this.totalCount()) * 100) : 0
  );

  /** Visible para el owner, con datos cargados y mientras no lo descarte. */
  public readonly visible = computed(
    () => this.loaded() && !this.dismissedCached() && this.permissions.isOwner()
  );
  public readonly isLoading = computed(
    () => !this.loaded() && !this.dismissedCached() && this.permissions.isOwner()
  );

  async ngOnInit(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    const id = String(tenantId);

    try {
      if (localStorage.getItem(this.dismissKey(id)) === '1') {
        this.dismissedCached.set(true);
        return;
      }
    } catch {
      /* sin localStorage → seguimos */
    }

    this.planStore.loadTenantPlanUsage();
    await this.configStore.loadConfig(id);
    const notify = await this.configService.getWhatsappNotifySettings(id);
    notify.mapRight((s) => this.notifyNumber.set(s.recipientNumber));
    const payments = await this.configService.getPaymentMethods(id);
    if (payments.isRight()) {
      this.activePaymentCount.set(
        payments.value.filter((m) => m.isActive).length
      );
    }
    this.loaded.set(true);
  }

  private dismissKey(tenantId: string): string {
    return `home_progress_dismissed_${tenantId}`;
  }

  public go(step: ProgressStep): void {
    void this.router.navigate([step.link], {
      queryParams: step.queryParams ?? undefined,
    });
  }

  public dismiss(): void {
    this.dismissedCached.set(true);
    void this.tenantStore.getTenantIdAsync().then((tenantId) => {
      if (tenantId == null) return;
      try {
        localStorage.setItem(this.dismissKey(String(tenantId)), '1');
      } catch {
        /* noop */
      }
    });
  }
}

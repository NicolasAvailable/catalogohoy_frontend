import { CommonModule, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EcommerceConfigStore,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { Order, OrderService } from '@catalogohoy/order';
import { PlanStore } from '@catalogohoy/plan';
import { CreditsStore } from '@catalogohoy/product';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { qr } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  AccordionComponent,
  AccordionHeaderDirective,
  AccordionPanelDirective,
  ButtonComponent,
  IconComponent,
} from '@ui';
import { HomeStore } from '../../infrastructure/home.store';

type ChartTab = 'ventas' | 'pedidos';
type Currency = 'bs' | 'usd';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    ButtonComponent,
    AccordionComponent,
    AccordionHeaderDirective,
    AccordionPanelDirective,
    DecimalPipe,
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit {
  private readonly homeStore = inject(HomeStore);
  private readonly tenantStore = inject(TenantStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly permissionsStore = inject(TeamPermissionsStore);
  public readonly planStore = inject(PlanStore);
  public readonly credits = inject(CreditsStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly orderService = inject(OrderService);
  private readonly toast = inject(ToastService);

  public readonly showDashboard = computed(() => {
    return this.permissionsStore.isOwner() || this.permissionsStore.can()('ordenes', 'view');
  });

  public readonly tenantName = computed(() => this.tenantStore.tenantName());
  public readonly stats = computed(() => this.homeStore.stats());
  public readonly isLoading = computed(() => this.homeStore.isLoading());

  public readonly greeting = computed(() => {
    const name = this.tenantName();
    return name ? `Hola, ${name}` : 'Hola';
  });

  public activeChartTab = signal<ChartTab>('ventas');
  // For VE: user toggles between 'bs' and 'usd'. For non-VE: always 'usd'
  // (prices are stored in USD internally; symbol comes from the tenant currency).
  public activeCurrency = signal<Currency>('bs');

  constructor() {
    // Auto-align the chart currency with the tenant country once it loads.
    effect(() => {
      if (this.tenantCurrency.isLoaded() && !this.tenantCurrency.isVenezuela()) {
        this.activeCurrency.set('usd');
      }
    });
  }

  // Metrics + chart prefix:
  //   VE     → 'Bs.' or '$' depending on chart toggle
  //   non-VE → local symbol from TenantCurrencyStore (e.g. 'S/', 'Bs', '$')
  public readonly currencyPrefix = computed(() => {
    if (!this.tenantCurrency.isVenezuela()) {
      return this.tenantCurrency.localSymbol();
    }
    return this.activeCurrency() === 'bs' ? 'Bs.' : '$';
  });

  public readonly chartBars = computed(() => {
    const data = this.stats()?.weeklyData;
    if (!data) return [];

    const tab = this.activeChartTab();
    const currency = this.activeCurrency();
    const values = data.map((d) =>
      tab === 'ventas'
        ? currency === 'bs' ? d.salesBs : d.salesUsd
        : d.orders
    );
    const max = Math.max(...values, 1);

    return data.map((d, i) => ({
      label: d.label,
      value: values[i],
      height: Math.max((values[i] / max) * 100, 2),
    }));
  });

  public readonly moduleCards = signal([
    {
      title: 'Productos',
      description: 'Gestiona tu inventario, precios y stock de productos.',
      icon: 'package',
      route: 'products',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
    },
    {
      title: 'Ordenes',
      description: 'Registra y controla tus ventas y pedidos.',
      icon: 'clipboard-list',
      route: 'orders',
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-50',
    },
    {
      title: 'Clientes',
      description: 'Administra tu base de clientes y contactos.',
      icon: 'users',
      route: 'clients',
      colorClass: 'text-green-600',
      bgClass: 'bg-green-50',
    },
    {
      title: 'Editar catálogo',
      description: 'Personaliza tu catalogo y opciones de pago.',
      icon: 'settings',
      route: 'catalog/edit',
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
    },
  ]);

  // ── Compartir tu catálogo ──────────────────────────────────────────────
  public readonly catalogUrl = computed(
    () => this.tenantStore.defaultTenant()?.url ?? ''
  );

  // ── Checklist de configuración ─────────────────────────────────────────
  // Pasos con estado REAL y sin efectos secundarios: productos, personalización
  // y compartir. "Compartir" se marca en localStorage al usar cualquier acción
  // del bloque "Compartir tu catálogo".
  public readonly hasShared = signal<boolean>(false);
  private readonly hasProducts = computed(
    () => this.planStore.currentProductCount() > 0
  );
  private readonly hasCustomized = computed(() => {
    const c = this.configStore.config();
    return !!(c?.logo || c?.banner);
  });
  public readonly checklistSteps = computed(() => [
    {
      key: 'products',
      label: 'Agregá tus productos',
      description: 'Cargá al menos un producto a tu catálogo.',
      done: this.hasProducts(),
      route: 'products' as string | null,
      icon: 'package',
    },
    {
      key: 'customize',
      label: 'Personalizá tu catálogo',
      description: 'Subí tu logo o banner y elegí los colores.',
      done: this.hasCustomized(),
      route: 'catalog/edit' as string | null,
      icon: 'palette',
    },
    {
      key: 'share',
      label: 'Compartí tu catálogo',
      description: 'Enviá el link o el QR a tus clientes.',
      done: this.hasShared(),
      route: null as string | null,
      icon: 'share-2',
    },
  ]);
  public readonly checklistDone = computed(
    () => this.checklistSteps().filter((s) => s.done).length
  );
  public readonly checklistTotal = computed(() => this.checklistSteps().length);
  public readonly showChecklist = computed(
    () => this.checklistDone() < this.checklistTotal()
  );

  // ── Uso de tu plan ─────────────────────────────────────────────────────
  public readonly planName = computed(
    () => this.planStore.currentPlan()?.name ?? '—'
  );
  public readonly isTopPlan = computed(
    () => this.planStore.currentPlan()?.id === 'avanzado'
  );
  public readonly planMetrics = computed(() => {
    const usedP = this.planStore.currentProductCount();
    const maxP = this.planStore.maxProducts();
    const usedC = this.planStore.currentCatalogCount();
    const maxC = this.planStore.maxCatalogs();
    return [
      {
        label: 'Productos',
        icon: 'package',
        used: usedP,
        max: maxP,
        unlimited: maxP === 0,
        pct: maxP === 0 ? 0 : Math.min(100, Math.round((usedP / maxP) * 100)),
      },
      {
        label: 'Catálogos',
        icon: 'store',
        used: usedC,
        max: maxC,
        unlimited: maxC === 0,
        pct: maxC === 0 ? 0 : Math.min(100, Math.round((usedC / maxC) * 100)),
      },
    ];
  });

  // ── Últimos pedidos ────────────────────────────────────────────────────
  public readonly recentOrders = signal<Order[]>([]);
  public readonly recentOrdersLoading = signal<boolean>(true);

  // Default home items (for members without order permissions)
  public readonly items = signal([
    {
      label: 'Crear Producto',
      ref: 'product',
      icon: 'package',
      description: 'Agrega nuevos items a tu inventario',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
    },
    {
      label: 'Crear Categoria',
      ref: 'category',
      icon: 'tag',
      description: 'Organiza tus productos por tipo',
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
    },
    {
      label: 'Crear Orden',
      ref: 'order',
      icon: 'notepad-text',
      description: 'Registra tus ventas manualmente',
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-50',
    },
  ]);

  async ngOnInit(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) this.tenantCurrency.load(tenantId);
    this.hasShared.set(localStorage.getItem('catalogohoy-shared') === '1');

    const loadDashboard = async () => {
      if (!this.showDashboard() || !tenantId) return;
      await this.homeStore.loadStats();
      // Datos de los widgets del home (uso del plan, créditos, config y pedidos).
      this.planStore.loadTenantPlanUsage();
      this.credits.load();
      this.configStore.loadConfig(String(tenantId));
      this.loadRecentOrders(tenantId);
    };

    if (this.permissionsStore.isLoaded()) {
      await loadDashboard();
    } else {
      const check = setInterval(async () => {
        if (this.permissionsStore.isLoaded()) {
          clearInterval(check);
          await loadDashboard();
        }
      }, 100);
    }
  }

  private async loadRecentOrders(tenantId: number): Promise<void> {
    this.recentOrdersLoading.set(true);
    const res = await this.orderService.getOrdersByTenant(tenantId, {
      pageSize: 5,
      orderBy: 'date_desc',
    });
    res
      .mapRight(({ orders }) => this.recentOrders.set(orders))
      .mapLeft(() => this.recentOrders.set([]));
    this.recentOrdersLoading.set(false);
  }

  setChartTab(tab: ChartTab): void {
    this.activeChartTab.set(tab);
  }

  setCurrency(currency: Currency): void {
    this.activeCurrency.set(currency);
  }

  statusLabel(status: string): string {
    return status === 'completed'
      ? 'Completado'
      : status === 'cancelled'
        ? 'Cancelado'
        : 'Pendiente';
  }

  // ── Acciones de "Compartir tu catálogo" ────────────────────────────────
  openCatalog(): void {
    const url = this.catalogUrl();
    if (url) window.open(url, '_blank');
  }

  async copyLink(): Promise<void> {
    const url = this.catalogUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Link copiado');
      this.markShared();
    } catch {
      this.toast.warning('No se pudo copiar el link');
    }
  }

  shareWhatsapp(): void {
    const url = this.catalogUrl();
    if (!url) return;
    const text = encodeURIComponent(`Mirá mi catálogo online: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    this.markShared();
  }

  async downloadQr(): Promise<void> {
    const tenant = this.tenantStore.defaultTenant();
    if (!tenant?.url) return;
    try {
      await qr.to.pdf(tenant.url, `QR-${tenant.slug}`, tenant.name);
      this.markShared();
    } catch {
      this.toast.warning('No se pudo generar el QR');
    }
  }

  private markShared(): void {
    if (this.hasShared()) return;
    localStorage.setItem('catalogohoy-shared', '1');
    this.hasShared.set(true);
  }
}


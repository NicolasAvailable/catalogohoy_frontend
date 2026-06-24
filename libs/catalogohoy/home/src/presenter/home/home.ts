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
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
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

    if (this.permissionsStore.isLoaded()) {
      if (this.showDashboard()) {
        await this.homeStore.loadStats();
      }
    } else {
      const check = setInterval(async () => {
        if (this.permissionsStore.isLoaded()) {
          clearInterval(check);
          if (this.showDashboard()) {
            await this.homeStore.loadStats();
          }
        }
      }, 100);
    }
  }

  setChartTab(tab: ChartTab): void {
    this.activeChartTab.set(tab);
  }

  setCurrency(currency: Currency): void {
    this.activeCurrency.set(currency);
  }
}


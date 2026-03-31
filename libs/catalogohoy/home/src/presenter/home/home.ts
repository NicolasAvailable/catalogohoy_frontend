import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  public readonly chartBars = computed(() => {
    const data = this.stats()?.weeklyData;
    if (!data) return [];

    const tab = this.activeChartTab();
    const values = data.map((d) => (tab === 'ventas' ? d.salesBs : d.orders));
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
}

import { NgClass } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthenticationService } from '@catalogohoy/auth';
import { PosthogService } from '@catalogohoy/core';
import { PlanStore } from '@catalogohoy/plan';
import { ProfileStore } from '@catalogohoy/profile';
import { Tenant, TenantStore, getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import {
  AvatarComponent,
  ConfirmDialogService,
  IconComponent,
  PanelMenuComponent,
  PanelMenuItem,
} from '@ui';
import { TooltipModule } from 'primeng/tooltip';
import { CATALOG_MENU, PRODUCTS_MENU, TEAMS_MENU } from './sidebar.constants';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    NgClass,
    PanelMenuComponent,
    IconComponent,
    AvatarComponent,
    TooltipModule,
  ],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  public visible = input<boolean>(false);
  public closeSidebar = output<void>();

  private router = inject(Router);
  private authService = inject(AuthenticationService);
  private confirmService = inject(ConfirmDialogService);
  private posthog = inject(PosthogService);
  public readonly planStore = inject(PlanStore);
  public readonly profileStore = inject(ProfileStore);
  public readonly tenantStore = inject(TenantStore);

  private readonly permissionsStore = inject(TeamPermissionsStore);

  public readonly analyticsLocked = computed(
    () => this.planStore.currentPlan()?.isFree ?? false
  );

  public readonly teamsLocked = computed(
    () => this.planStore.currentPlan()?.isFree ?? false
  );

  public readonly canViewProducts = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('productos', 'view')
  );
  public readonly canViewOrders = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('ordenes', 'view')
  );
  public readonly canViewClients = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('clientes', 'view')
  );
  public readonly canViewAnalytics = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('analiticas', 'view')
  );
  public readonly canViewRates = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('tasas', 'edit')
  );
  public readonly canViewCatalog = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('catalogo', 'edit')
  );
  public readonly canViewTeam = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('equipo', 'view')
  );

  public readonly noPermissionTooltip = 'Habla con el dueño del catálogo para obtener acceso a este módulo';
  public readonly transitionOptions = '200ms cubic-bezier(0.86, 0, 0.07, 1)';
  public readonly productsMenu: PanelMenuItem[] = PRODUCTS_MENU;
  public readonly catalogMenu: PanelMenuItem[] = CATALOG_MENU;
  public readonly teamsMenu: PanelMenuItem[] = TEAMS_MENU;

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && this.visible()) {
        this.closeSidebar.emit();
      }
    });
  }

  public readonly showCatalogSwitcher = signal(false);
  public readonly allTenants = computed(() => this.profileStore.profile().tenantList.tenants);
  public readonly isOwner = computed(() => this.permissionsStore.isOwner());

  public readonly currentTenantSlug = computed(() =>
    getTenantSlugFromUrl() || this.tenantStore.tenantSlug() || ''
  );

  public readonly currentTenant = computed(() => {
    const slug = this.currentTenantSlug();
    const tenants = this.profileStore.profile().tenantList.tenants;
    return tenants.find((t) => t.slug === slug) ?? this.profileStore.profile().tenantList.first;
  });

  public toggleCatalogSwitcher() {
    this.showCatalogSwitcher.update((v) => !v);
  }

  public openTenantCatalog(tenant: Tenant) {
    if (tenant.slug === this.currentTenantSlug()) return;
    window.open(this.authService.buildTenantAdminUrl(tenant.slug, tenant.customDomain), '_blank');
    this.showCatalogSwitcher.set(false);
  }

  public navigateToCreateCatalog(): void {
    this.showCatalogSwitcher.set(false);
    this.router.navigate(['/admin/new-catalog']);
  }

  public toggle(item: PanelMenuItem) {
    if (item['data']?.['externalUrl']) {
      const url = this.currentTenant()?.url ?? this.profileStore.profile().tenantList.first.url;
      window.open(url, '_blank');
      return;
    }
    if (item.state) {
      item.state['isOpen'] = !item.state['isOpen'];
    }
  }

  public isActive(item: PanelMenuItem): boolean {
    if (item.routerLink) {
      const url = this.router.serializeUrl(
        this.router.createUrlTree(
          Array.isArray(item.routerLink) ? item.routerLink : [item.routerLink]
        )
      );
      return this.router.isActive(url, {
        paths: item.routerLinkActiveOptions?.exact ? 'exact' : 'subset',
        queryParams: 'ignored',
        fragment: 'ignored',
        matrixParams: 'ignored',
      });
    }
    if (item.items) {
      return item.items.some((child: PanelMenuItem) => this.isActive(child));
    }
    return false;
  }

  public logout() {
    this.confirmService
      .warning({
        headerLabel: '¿Cerrar sesión?',
        contentLabel: '¿Estás seguro que deseas cerrar sesión?',
        acceptLabel: 'Cerrar sesión',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        if (result.isRight()) {
          this.posthog.reset();
          this.authService.logout().then(() => {
            window.location.href = 'https://auth.catalogohoy.com';
          });
        }
      });
  }
}

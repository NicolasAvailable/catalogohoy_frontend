import { NgClass } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthenticationService } from '@catalogohoy/auth';
import { PosthogService } from '@catalogohoy/core';
import { ProfileStore } from '@catalogohoy/profile';
import { Tenant, TenantStore } from '@catalogohoy/tenant';
import {
  AvatarComponent,
  ConfirmDialogService,
  IconComponent,
  PanelMenuComponent,
  PanelMenuItem,
} from '@ui';
import { CATALOG_MENU, PRODUCTS_MENU } from './sidebar.constants';

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
  public readonly profileStore = inject(ProfileStore);
  public readonly tenantStore = inject(TenantStore);

  public readonly transitionOptions = '200ms cubic-bezier(0.86, 0, 0.07, 1)';
  public readonly productsMenu: PanelMenuItem[] = PRODUCTS_MENU;
  public readonly catalogMenu: PanelMenuItem[] = CATALOG_MENU;

  public readonly showCatalogSwitcher = signal(false);
  public readonly allTenants = computed(() => this.profileStore.profile().tenantList.tenants);

  public toggleCatalogSwitcher() {
    this.showCatalogSwitcher.update((v) => !v);
  }

  public openTenantCatalog(tenant: Tenant) {
    window.open(tenant.url, '_blank');
    this.showCatalogSwitcher.set(false);
  }

  public toggle(item: PanelMenuItem) {
    if (item['data']?.['externalUrl']) {
      const url = this.profileStore.profile().tenantList.first.url;
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

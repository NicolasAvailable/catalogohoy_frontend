import { NgClass } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthenticationService } from '@catalogohoy/auth';
import { ProfileStore } from '@catalogohoy/profile';
import { TenantStore } from '@catalogohoy/tenant';
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
  public readonly profileStore = inject(ProfileStore);
  public readonly tenantStore = inject(TenantStore);

  public readonly transitionOptions = '200ms cubic-bezier(0.86, 0, 0.07, 1)';
  public readonly productsMenu: PanelMenuItem[] = PRODUCTS_MENU;
  public readonly catalogMenu: PanelMenuItem[] = CATALOG_MENU;

  public toggle(item: PanelMenuItem) {
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
          this.authService.logout().then(() => {
            window.location.href = 'https://auth.catalogohoy.com';
          });
        }
      });
  }
}

import { NgClass } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, PanelMenuComponent, PanelMenuItem } from '@ui';
import { CATALOG_MENU, PRODUCTS_MENU } from './sidebar.constants';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    NgClass,
    PanelMenuComponent,
    IconComponent,
  ],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  public visible = input<boolean>(false);
  public closeSidebar = output<void>();

  private router = inject(Router);

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
      return item.items.some((child) => this.isActive(child));
    }
    return false;
  }
}

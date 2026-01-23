import { NgClass } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, PanelMenuComponent, PanelMenuItem } from '@ui';

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

  public readonly transitionOptions = '200ms cubic-bezier(0.86, 0, 0.07, 1)';
  public readonly productsMenu: PanelMenuItem[] = [
    {
      label: 'Productos',
      icon: 'tag',
      iconNext: 'chevron-right',
      state: { isOpen: false },
      items: [
        {
          label: 'Listado de productos',
          routerLink: 'products',
          routerLinkActiveOptions: { exact: true },
        },
        {
          label: 'Categorías',
          routerLink: 'categories',
          routerLinkActiveOptions: { exact: true },
        },
        {
          label: 'Cupones',
          routerLink: 'coupons',
          routerLinkActiveOptions: { exact: true },
        },
      ],
    },
  ];

  public toggle(item: PanelMenuItem) {
    if (item.state) {
      item.state['isOpen'] = !item.state['isOpen'];
    }
  }
}

import { NgClass } from '@angular/common';
import { Component } from '@angular/core';
import { IconComponent, PanelMenuComponent, PanelMenuItem } from '@ui';

@Component({
  selector: 'app-sidebar',
  imports: [NgClass, PanelMenuComponent, IconComponent],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  public readonly transitionOptions = '200ms cubic-bezier(0.86, 0, 0.07, 1)';
  public readonly productsMenu: PanelMenuItem[] = [
    {
      label: 'Productos',
      icon: 'tag',
      iconNext: 'chevron-right',
      state: { isOpen: false },
      items: [
        {
          label: 'Todo',
          routerLink: '/products',
          routerLinkActiveOptions: { exact: true },
        },
        {
          label: 'Categotias',
          routerLink: '/category',
          routerLinkActiveOptions: { exact: true },
        },
        {
          label: 'Cupones',
          routerLink: '/coupons',
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

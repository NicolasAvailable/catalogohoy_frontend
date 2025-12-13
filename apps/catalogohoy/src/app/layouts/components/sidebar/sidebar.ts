import { Component } from '@angular/core';
import { IconComponent, PanelMenuComponent, PanelMenuItem } from '@ui';

@Component({
  selector: 'app-sidebar',
  imports: [PanelMenuComponent, IconComponent],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  public readonly transitionOptions = '200ms cubic-bezier(0.86, 0, 0.07, 1)';
  public readonly productsMenu: PanelMenuItem[] = [
    {
      label: 'Productos',
      icon: 'tag',
      routerLink: '/dashboard',
      routerLinkActiveOptions: { exact: true },
      items: [
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
}

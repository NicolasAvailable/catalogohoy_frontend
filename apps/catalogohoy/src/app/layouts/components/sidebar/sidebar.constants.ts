import { PanelMenuItem } from '@ui';

export const PRODUCTS_MENU: PanelMenuItem[] = [
  {
    label: 'Productos',
    icon: 'tag',
    iconNext: 'chevron-right',
    state: { isOpen: false },
    items: [
      {
        label: 'Listado de productos',
        routerLink: '/admin/products',
        routerLinkActiveOptions: { exact: true },
      },
      {
        label: 'Categorías',
        routerLink: '/admin/categories',
        routerLinkActiveOptions: { exact: true },
      },
    ],
  },
];

export const CATALOG_MENU: PanelMenuItem[] = [
  {
    label: 'Mi catálogo',
    icon: 'tag',
    iconNext: 'chevron-right',
    state: { isOpen: false },
    items: [
      {
        label: 'Ver mi catálogo',
        routerLink: '/',
        iconNext: 'square-arrow-out-up-right',
        routerLinkActiveOptions: { exact: true },
      },
      {
        label: 'Editar',
        routerLink: '/admin/catalog/edit',
        routerLinkActiveOptions: { exact: true },
      },
    ],
  },
];

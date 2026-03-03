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

export const TEAMS_MENU: PanelMenuItem[] = [
  {
    label: 'Equipo',
    icon: 'users',
    routerLink: '/admin/teams',
    routerLinkActiveOptions: { exact: false },
  },
];

export const CATALOG_MENU: PanelMenuItem[] = [
  {
    label: 'Mi catálogo',
    icon: 'store',
    iconNext: 'chevron-right',
    state: { isOpen: false },
    items: [
      {
        label: 'Ver mi catálogo',
        iconNext: 'square-arrow-out-up-right',
        data: { externalUrl: true },
      },
      {
        label: 'Editar',
        routerLink: '/admin/catalog/edit',
        routerLinkActiveOptions: { exact: true },
      },
      {
        label: 'Crear',
        routerLink: '/admin/catalog/create',
        routerLinkActiveOptions: { exact: true },
      },
    ],
  },
];

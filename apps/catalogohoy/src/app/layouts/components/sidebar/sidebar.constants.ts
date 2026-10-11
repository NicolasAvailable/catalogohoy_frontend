import { PanelMenuItem } from '@ui';

export const PRODUCTS_MENU: PanelMenuItem[] = [
  {
    label: 'Productos',
    icon: 'tag',
    iconNext: 'chevron-right',
    expanded: true,
    state: { isOpen: true },
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

// Chat es ahora una sola vista (sin submenú): el ítem del sidebar apunta
// directo a /admin/chat, que decide entre la landing de configuración, la
// pantalla de conectar canales o la bandeja según el estado del catálogo.
// Las plantillas y los comentarios siguen accesibles por link directo.

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
    expanded: true,
    state: { isOpen: true },
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
    ],
  },
];

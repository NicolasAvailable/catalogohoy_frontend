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

// Bandeja de comentarios de posts (IG + FB): oculta hasta el App Review de
// Meta (comments/feed). Flip a true para exponerla en el menú.
export const COMMENTS_MENU_ENABLED = false;

export const CHAT_MENU: PanelMenuItem[] = [
  {
    label: 'Chats',
    icon: 'message-square',
    iconNext: 'chevron-right',
    expanded: true,
    state: { isOpen: true },
    items: [
      {
        label: 'Conectar',
        routerLink: '/admin/chat/connect',
        routerLinkActiveOptions: { exact: true },
      },
      {
        label: 'Mensajes',
        routerLink: '/admin/chat/conversations',
        routerLinkActiveOptions: { exact: true },
      },
      ...(COMMENTS_MENU_ENABLED
        ? [
            {
              label: 'Comentarios',
              routerLink: '/admin/chat/comments',
              routerLinkActiveOptions: { exact: true },
            } as PanelMenuItem,
          ]
        : []),
      {
        label: 'Plantillas',
        routerLink: '/admin/chat/templates',
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

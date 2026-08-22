export interface InternalNavItem {
  label: string;
  icon: string;
  routerLink: string;
  exact?: boolean;
}

export const INTERNAL_NAV: InternalNavItem[] = [
  {
    label: 'Inicio',
    icon: 'layout-grid',
    routerLink: '/',
    exact: true,
  },
  {
    label: 'Catálogos',
    icon: 'store',
    routerLink: '/tenants',
  },
  {
    label: 'Usuarios',
    icon: 'users',
    routerLink: '/users',
  },
  {
    label: 'Catálogos activos',
    icon: 'credit-card',
    routerLink: '/paying-clients',
  },
  {
    label: 'Clientes pagos',
    icon: 'contact',
    routerLink: '/paying-accounts',
  },
  {
    label: 'Leads Enterprise',
    icon: 'building-2',
    routerLink: '/enterprise-leads',
  },
  {
    label: 'Notificaciones WhatsApp',
    icon: 'message-circle',
    routerLink: '/whatsapp-logs',
  },
  {
    label: 'Canales conectados',
    icon: 'link-2',
    routerLink: '/channel-connections',
  },
  {
    label: 'Órdenes',
    icon: 'shopping-bag',
    routerLink: '/orders',
  },
  {
    label: 'Cupones',
    icon: 'ticket-percent',
    routerLink: '/coupons',
  },
  {
    label: 'Gastos',
    icon: 'wallet',
    routerLink: '/expenses',
  },
  {
    label: 'Uso de IA',
    icon: 'sparkles',
    routerLink: '/ai-usage',
  },
  {
    label: 'Emails',
    icon: 'mail',
    routerLink: '/emails',
  },
];

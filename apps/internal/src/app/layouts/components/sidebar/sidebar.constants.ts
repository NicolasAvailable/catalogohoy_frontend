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
];

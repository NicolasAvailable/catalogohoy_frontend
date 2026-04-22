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
    label: 'Clientes pagos',
    icon: 'credit-card',
    routerLink: '/paying-clients',
  },
  {
    label: 'Planes',
    icon: 'crown',
    routerLink: '/plans',
  },
];

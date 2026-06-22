import { Route } from '@angular/router';

export const platformOrdersRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./platform-orders').then((m) => m.PlatformOrders),
  },
];

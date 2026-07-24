import { Route } from '@angular/router';

export const channelConnectionsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./channel-connections').then((m) => m.ChannelConnections),
  },
];

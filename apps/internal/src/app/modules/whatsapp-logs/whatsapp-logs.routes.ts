import { Route } from '@angular/router';

export const whatsappLogsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./whatsapp-logs').then((m) => m.WhatsappLogs),
  },
];

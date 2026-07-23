import { Route } from '@angular/router';

export const CHAT_ROUTES: Route[] = [
  {
    path: '',
    redirectTo: 'conversations',
    pathMatch: 'full',
  },
  {
    path: 'conversations',
    loadComponent: () =>
      import('./views/conversations/conversations').then(
        (c) => c.ConversationsComponent
      ),
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./views/templates/templates').then((c) => c.TemplatesComponent),
  },
  {
    // Página "Conectar a WhatsApp Business" (coexistencia / solo API).
    path: 'connect',
    loadComponent: () =>
      import('@catalogohoy/whatsapp').then((m) => m.WhatsAppConnectComponent),
  },
  {
    // Pantalla dedicada "Conectar a Instagram" (Instagram Login).
    path: 'connect/instagram',
    loadComponent: () =>
      import('@catalogohoy/whatsapp').then((m) => m.InstagramConnectComponent),
  },
  {
    // Pantalla dedicada "Conectar a TikTok" (Business Messaging, beta).
    path: 'connect/tiktok',
    loadComponent: () =>
      import('@catalogohoy/whatsapp').then((m) => m.TikTokConnectComponent),
  },
];

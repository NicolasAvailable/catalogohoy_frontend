import { Route } from '@angular/router';

export const CHAT_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./views/chat-layout/chat-layout').then(
        (c) => c.ChatLayoutComponent
      ),
  },
];

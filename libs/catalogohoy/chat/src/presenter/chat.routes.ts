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
];

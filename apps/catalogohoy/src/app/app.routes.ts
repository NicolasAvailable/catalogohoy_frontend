import { Route } from '@angular/router';
import { authenticationGuard } from '@catalogohoy/auth';
import { profileResolver } from '@catalogohoy/profile';
import { isValidSlugGuard } from '@catalogohoy/tenant';
import { hasAccessGuard, teamPermissionsResolver } from '@catalogohoy/teams';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [isValidSlugGuard],
    loadChildren: () =>
      import('@catalogohoy/e-commerce').then((m) => m.ecommerceRoutes),
  },
  {
    path: 'admin',
    canActivate: [isValidSlugGuard, authenticationGuard],
    resolve: {
      profile: profileResolver,
      teamPermissions: teamPermissionsResolver,
    },
    canActivateChild: [hasAccessGuard],
    loadComponent: () => import('./layouts/layout').then((m) => m.default),
    loadChildren: () =>
      import('./modules/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    // Onboarding wizard (full-screen, sin el layout admin). Mismos guards de
    // auth + slug + perfil que el admin.
    path: 'onboarding',
    canActivate: [isValidSlugGuard, authenticationGuard],
    resolve: {
      profile: profileResolver,
    },
    loadChildren: () =>
      import('@catalogohoy/onboarding').then((m) => m.onboardingRoutes),
  },
  {
    path: 'catalog-unavailable',
    loadComponent: () =>
      import('@catalogohoy/tenant').then((m) => m.CatalogUnavailableView),
  },
  {
    path: 'public/report',
    loadChildren: () =>
      import('@catalogohoy/reports').then((m) => m.REPORTS_PUBLIC_ROUTES),
  },
  {
    // Public "customer" side of the WhatsApp chat demo — anon-accessible so it
    // can be opened on a phone to chat live against the tenant's inbox.
    path: 'public/chat-demo',
    loadComponent: () =>
      import('@catalogohoy/chat').then((m) => m.CustomerSimulatorComponent),
  },
  {
    // Puente de conexión de WhatsApp en dominio fijo (conectar.catalogohoy.com):
    // el SDK JS de Facebook exige dominios exactos → los clientes llegan aquí
    // con un state firmado (wa-onboard) y vuelven a su admin al terminar.
    path: 'conectar/whatsapp',
    loadComponent: () =>
      import('@catalogohoy/whatsapp').then((m) => m.WhatsAppBridgeComponent),
  },
  {
    path: 'no-access',
    canActivate: [authenticationGuard],
    resolve: {
      profile: profileResolver,
    },
    loadComponent: () =>
      import('@catalogohoy/teams').then((m) => m.NoAccessView),
  },
  {
    path: '**',
    redirectTo: '',
  },
];


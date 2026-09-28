import { Route } from '@angular/router';
import { authenticationGuard } from '@catalogohoy/auth';
import { profileResolver } from '@catalogohoy/profile';
import { isValidSlugGuard } from '@catalogohoy/tenant';
import { hasAccessGuard, teamPermissionsResolver } from '@catalogohoy/teams';
import { nativeEntryGuard } from './mobile/native-entry.guard';
import { posEnabledGuard } from './modules/pos/pos-enabled.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    // nativeEntryGuard: en la app nativa redirige la raíz a /admin o /login
    // (no hay storefront en nativo). En web es no-op y sigue isValidSlugGuard.
    canActivate: [nativeEntryGuard, isValidSlugGuard],
    loadChildren: () =>
      import('@catalogohoy/e-commerce').then((m) => m.ecommerceRoutes),
  },
  {
    // Login in-app SOLO para el shell nativo (en web el login vive en
    // auth.catalogohoy.com). Reusa el componente Login de @catalogohoy/auth.
    path: 'login',
    loadComponent: () => import('@catalogohoy/auth').then((m) => m.Login),
  },
  {
    // Recuperar contraseña in-app (shell nativo). El email de reset apunta al
    // /reset-password web real (auth.catalogohoy.com), no a localhost — ver
    // `forgottenPassword` en authentication.service.ts.
    path: 'forgot-password',
    loadComponent: () =>
      import('@catalogohoy/auth').then((m) => m.ForgottenPassword),
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
    // Punto de Venta: experiencia full-screen con barra lateral propia (fuera
    // del layout del admin). Mismos guards que /admin (slug válido, sesión y
    // permisos de equipo) + gate por plan (solo Avanzado/Enterprise).
    path: 'pos',
    canActivate: [isValidSlugGuard, authenticationGuard, posEnabledGuard],
    resolve: {
      profile: profileResolver,
      teamPermissions: teamPermissionsResolver,
    },
    canActivateChild: [hasAccessGuard],
    loadComponent: () => import('./modules/pos/pos-shell'),
    loadChildren: () =>
      import('./modules/pos/pos.routes').then((m) => m.posRoutes),
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


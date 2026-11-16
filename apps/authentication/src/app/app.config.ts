import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import {
  META_PLATFORM_PIXEL_ROUTE,
  provideIcons,
  providePrimeNG,
  provideSentry,
  provideTranslation,
  provideUi,
} from '@catalogohoy/core';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withViewTransitions()
    ),
    provideHttpClient(withFetch()),
    providePrimeNG(),
    provideTranslation(),
    provideUi(),
    provideIcons(),
    ...provideSentry(),
    // Registro/login: toda la app es de la plataforma → píxel propio en todas
    // las rutas (en la app principal solo carga en el backoffice).
    { provide: META_PLATFORM_PIXEL_ROUTE, useValue: () => true },
  ],
};

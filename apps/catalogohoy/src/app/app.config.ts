import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import {
  provideIcons,
  providePrimeNG,
  provideSentry,
  provideTranslation,
  provideUi,
} from '@catalogohoy/core';
import { appRoutes } from './app.routes';

registerLocaleData(localeEs);

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
    { provide: LOCALE_ID, useValue: 'es' },
  ],
};

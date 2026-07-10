import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import localePt from '@angular/common/locales/pt';
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
  resolveInitialLanguage,
} from '@catalogohoy/core';
import { appRoutes } from './app.routes';

// en viene incluido por defecto en Angular; se registran los otros 3 idiomas.
registerLocaleData(localeEs);
registerLocaleData(localeFr);
registerLocaleData(localePt);

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
    // Mismo idioma guardado que usa Transloco → fechas/números coherentes.
    { provide: LOCALE_ID, useFactory: resolveInitialLanguage },
  ],
};

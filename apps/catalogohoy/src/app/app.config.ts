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
  withPreloading,
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
import { provideIonicAngular } from '@ionic/angular/provide';
import { appRoutes } from './app.routes';
import { NativePreloadStrategy } from './mobile/native-preload.strategy';

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
      // Transición de ruta: en nativo se acelera por CSS (fade corto ~140ms,
      // ver styles.css `.native-app ::view-transition-*`) para que NO se sienta
      // el lag de la animación default; en web queda la default.
      withViewTransitions(),
      // En NATIVO precarga los lazy chunks en segundo plano (locales, sin red)
      // para que el cambio de sección sea instantáneo; en web no precarga nada.
      withPreloading(NativePreloadStrategy)
    ),
    provideHttpClient(withFetch()),
    providePrimeNG(),
    provideTranslation(),
    provideUi(),
    provideIcons(),
    // Ionic disponible para adopción progresiva (transiciones nativas,
    // ion-refresher, safe-areas). No inyecta CSS global: cada componente
    // Ionic standalone trae su estilo scopeado cuando lo usemos.
    provideIonicAngular({ mode: 'ios' }),
    ...provideSentry(),
    // Mismo idioma guardado que usa Transloco → fechas/números coherentes.
    { provide: LOCALE_ID, useFactory: resolveInitialLanguage },
  ],
};

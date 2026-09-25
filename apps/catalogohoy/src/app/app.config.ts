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
  NavigationError,
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withNavigationErrorHandler,
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
import { AppTitleStrategy } from './app-title.strategy';

// en viene incluido por defecto en Angular; se registran los otros 3 idiomas.
registerLocaleData(localeEs);
registerLocaleData(localeFr);
registerLocaleData(localePt);

/** Tras un deploy nuevo, los chunks lazy con hash viejo dejan de existir en el
 *  server. Si la app (que quedó abierta con el bundle anterior) navega a una
 *  ruta lazy, el import dinámico falla (ChunkLoadError) y se ve pantalla en
 *  blanco. Detectamos ese error y recargamos una vez para traer el bundle nuevo. */
function isChunkLoadError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  const msg = String(e?.message ?? err ?? '');
  return (
    e?.name === 'ChunkLoadError' ||
    /Loading chunk\s+\S+\s+failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

/** Hace una carga completa (a lo sumo una vez cada 10s, para no caer en un loop
 *  si el chunk sigue fallando por otra causa). Navega a `targetUrl` — la ruta que
 *  el usuario intentaba abrir — así queda en la pantalla que quería con el bundle
 *  nuevo, en vez de recargar la página anterior. */
function reloadForNewDeployOnce(targetUrl?: string): void {
  try {
    const KEY = 'chunk-reload-at';
    const last = Number(sessionStorage.getItem(KEY) ?? '0');
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sessionStorage no disponible: recargamos igual */
  }
  if (targetUrl) location.assign(targetUrl);
  else location.reload();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withViewTransitions(),
      // Deploy nuevo + bundle viejo abierto → el chunk lazy no existe y explota
      // en blanco. Recargamos para tomar el bundle nuevo.
      withNavigationErrorHandler((event: NavigationError) => {
        if (isChunkLoadError(event.error)) reloadForNewDeployOnce(event.url);
      })
    ),
    provideHttpClient(withFetch()),
    // Título de pestaña dinámico en el admin: "<Negocio> | <Módulo>".
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    providePrimeNG(),
    provideTranslation(),
    provideUi(),
    provideIcons(),
    ...provideSentry(),
    // Mismo idioma guardado que usa Transloco → fechas/números coherentes.
    { provide: LOCALE_ID, useFactory: resolveInitialLanguage },
  ],
};

import {
  EnvironmentProviders,
  ErrorHandler,
  inject,
  isDevMode,
  Provider,
  provideAppInitializer,
} from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@catalogohoy/env';
import * as Sentry from '@sentry/angular';
import {
  patchToastErrorReporting,
  reportErrorToSlack,
} from '../error-reporter/error-reporter';

interface InitSentryOptions {
  /** DSN del proyecto de Sentry de esta app (público; va en el bundle). */
  dsn: string;
  /** Nombre de la app, se usa como tag para distinguir en Sentry. */
  appName: string;
}

/**
 * Inicializa Sentry (errores + performance/tracing + session replay). Se llama
 * en `main.ts` ANTES de `bootstrapApplication` para capturar errores tempranos.
 * No hace nada en desarrollo ni si el DSN está vacío.
 */
export function initSentry({ dsn, appName }: InitSentryOptions): void {
  // OJO: NO usar `environment.production` para detectar prod. En este repo el
  // barrel `@catalogohoy/env` siempre exporta `environment.development`
  // (production:false), así que `environment.production` es SIEMPRE false.
  // El resto de la app detecta prod con `isDevMode()` (PostHog, MetaPixel…),
  // que sí es false en builds de producción. Sentry hace lo mismo.
  if (!dsn || isDevMode()) return;

  Sentry.init({
    dsn,
    environment: 'production',
    // Enviar logs a Sentry (feature "Logs").
    enableLogs: true,
    // Ruido que NO es de la app (terceros/navegadores in-app): se descarta para
    // no ensuciar Sentry. Matchea por substring del mensaje del error.
    ignoreErrors: [
      // Navegadores in-app (Instagram/Facebook/TikTok WebView): su propia
      // instrumentación (`iabjs://…navigation_performance_logger`) falla al hacer
      // postMessage cuando el WebView se destruye. No es un error nuestro.
      'Java object is gone',
      'Error invoking postMessage',
      // ResizeObserver: bucle benigno, ruido universal de Chrome.
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded',
    ],
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
        maskAllInputs: true,
      }),
    ],
    // Performance: % de transacciones muestreadas.
    tracesSampleRate: environment.sentryTracesSampleRate,
    // ⚠️ NO propagar trazas (NO adjuntar headers sentry-trace/baggage a las
    // requests). El tracing distribuido adjunta esos headers a las llamadas que
    // matcheen estos targets, pero las Edge Functions de Supabase tienen un
    // Access-Control-Allow-Headers FIJO (authorization, x-client-info, apikey,
    // content-type) que NO incluye sentry-trace/baggage → el browser bloquea el
    // POST en el preflight (OPTIONS 200 pero el POST nunca sale) y se rompe TODO
    // lo que llama a una edge function (checkout, IA, créditos…). Backend no
    // continúa la traza igual, así que no perdemos nada útil. Array vacío =
    // no adjuntar headers a ninguna request. NO agregar el dominio de Supabase.
    tracePropagationTargets: [],
    // Session Replay.
    replaysSessionSampleRate: environment.sentryReplaysSessionSampleRate,
    replaysOnErrorSampleRate: environment.sentryReplaysOnErrorSampleRate,
    initialScope: { tags: { app: appName } },
  });
}

/**
 * ¿Es un error de carga de un chunk lazy que ya no existe? Pasa cuando el
 * usuario tenía la app abierta durante un deploy: el index.html viejo referencia
 * `chunk-XXXX.js` que el deploy nuevo ya reemplazó → el import() dinámico falla.
 * No es un bug de la app; se recupera recargando para traer la versión nueva.
 *
 * Cubre las distintas variantes según el navegador:
 * - Chrome/Firefox: "Failed to fetch dynamically imported module"
 * - Safari/iOS: "'text/html' is not a valid JavaScript MIME type" / "Importing a
 *   module script failed" (el host devuelve el index.html en vez del .js).
 */
function isChunkLoadError(error: unknown): boolean {
  const msg = (error as { message?: string })?.message ?? String(error ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|Expected a JavaScript module script but the server responded with|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(
    msg
  );
}

const CHUNK_RELOAD_KEY = 'chunk-reload-at';

/**
 * Recarga la página UNA vez para traer assets frescos. Devuelve `true` si
 * disparó la recarga; `false` si ya recargamos hace <10s (anti-loop: si tras
 * recargar sigue fallando, dejamos que se reporte a Sentry en vez de loopear).
 */
function reloadForFreshAssets(): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    location.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * ErrorHandler que primero intenta **recuperar** los errores de chunk lazy
 * (típicos tras un deploy) recargando la página, y delega todo lo demás al
 * ErrorHandler de Sentry para que se reporte normal.
 */
class ChunkAwareErrorHandler implements ErrorHandler {
  private readonly sentry = Sentry.createErrorHandler();

  handleError(error: unknown): void {
    if (isChunkLoadError(error) && reloadForFreshAssets()) return;
    this.sentry.handleError(error);
    // Además de Sentry, al canal de Slack de errores (best-effort, dedupe).
    const err = error as { message?: string; stack?: string } | null;
    reportErrorToSlack(
      'uncaught',
      err?.message ?? String(error ?? 'error desconocido'),
      err?.stack?.split('\n').slice(0, 5).join('\n')
    );
  }
}

/**
 * Providers de Sentry para el `appConfig`: enchufa el ErrorHandler (con
 * recuperación de chunks lazy + reporte a Sentry) y el TraceService
 * (instrumentación de routing para performance).
 */
export function provideSentry(): (Provider | EnvironmentProviders)[] {
  return [
    {
      provide: ErrorHandler,
      useClass: ChunkAwareErrorHandler,
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    provideAppInitializer(() => {
      inject(Sentry.TraceService);
      // Todo toast.error (error mostrado al usuario) se reporta al canal
      // de Slack de errores — un solo parche cubre todos los call sites.
      patchToastErrorReporting();
    }),
  ];
}

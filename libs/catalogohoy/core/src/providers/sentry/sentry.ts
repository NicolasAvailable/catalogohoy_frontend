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
 * Providers de Sentry para el `appConfig`: enchufa el ErrorHandler de Sentry y
 * el TraceService (instrumentación de routing para performance).
 */
export function provideSentry(): (Provider | EnvironmentProviders)[] {
  return [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler(),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    provideAppInitializer(() => {
      inject(Sentry.TraceService);
    }),
  ];
}

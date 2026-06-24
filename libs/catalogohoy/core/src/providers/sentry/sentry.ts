import {
  EnvironmentProviders,
  ErrorHandler,
  inject,
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
  if (!dsn || !environment.production) return;

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
    // Conecta las trazas del front con el backend (Supabase) para distributed tracing.
    tracePropagationTargets: [
      /^https:\/\/[^/]*\.catalogohoy\.com/,
      /^https:\/\/yvkurjivijnhliofmfmj\.supabase\.co/,
    ],
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

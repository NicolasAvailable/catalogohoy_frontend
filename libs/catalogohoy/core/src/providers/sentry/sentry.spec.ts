/**
 * Cubre el ErrorHandler de Sentry: el foco del cambio es que los errores de
 * carga de chunk (ruido de deploy) se recuperan y se TRAGAN — no van ni a
 * Sentry ni al canal de Slack, ni siquiera cuando el anti-loop bloquea la
 * recarga. Los errores reales sí se reportan a ambos.
 */

const mockSentryHandleError = jest.fn();
const mockReportErrorToSlack = jest.fn();

jest.mock('@sentry/angular', () => ({
  init: jest.fn(),
  createErrorHandler: () => ({ handleError: mockSentryHandleError }),
  browserTracingIntegration: () => ({}),
  replayIntegration: () => ({}),
  TraceService: class {},
}));

jest.mock('../error-reporter/error-reporter', () => ({
  reportErrorToSlack: mockReportErrorToSlack,
  patchToastErrorReporting: jest.fn(),
}));

// isDevMode=false (para poder testear initSentry) + provideAppInitializer
// neutralizado (no nos interesa acá y evita depender de su implementación).
jest.mock('@angular/core', () => {
  const actual = jest.requireActual('@angular/core');
  return {
    ...actual,
    isDevMode: () => false,
    provideAppInitializer: () => ({ __appInit: true }),
  };
});

import { ErrorHandler } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { initSentry, provideSentry } from './sentry';

/** Instancia el ChunkAwareErrorHandler (privado) vía el provider público. */
function makeHandler(): ErrorHandler {
  const providers = provideSentry();
  const provider = providers.find(
    (p) => (p as { provide?: unknown }).provide === ErrorHandler
  ) as unknown as { useClass: new () => ErrorHandler };
  return new provider.useClass();
}

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: 'https://x.catalogohoy.com/', reload: jest.fn() },
  });
});

describe('ChunkAwareErrorHandler — corta el ruido de chunk, reporta lo real', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  const VARIANTES_CHUNK = [
    'Failed to fetch dynamically imported module: https://x/chunk-ABC.js',
    'Importing a module script failed.',
    "'text/html' is not a valid JavaScript MIME type",
    'error loading dynamically imported module: https://x/chunk-Z.js',
  ];

  it.each(VARIANTES_CHUNK)(
    'chunk-error NO va a Sentry ni a Slack: %s',
    (msg) => {
      makeHandler().handleError(new Error(msg));
      expect(mockSentryHandleError).not.toHaveBeenCalled();
      expect(mockReportErrorToSlack).not.toHaveBeenCalled();
    }
  );

  it('anti-loop (2º fallo <10s): se traga igual, no ensucia los canales', () => {
    const handler = makeHandler();
    handler.handleError(new Error('Importing a module script failed.')); // intenta reload
    handler.handleError(new Error('Importing a module script failed.')); // anti-loop
    expect(mockSentryHandleError).not.toHaveBeenCalled();
    expect(mockReportErrorToSlack).not.toHaveBeenCalled();
  });

  it('error normal: reporta a Sentry Y al canal de Slack', () => {
    makeHandler().handleError(new Error('boom de verdad'));
    expect(mockSentryHandleError).toHaveBeenCalledTimes(1);
    expect(mockReportErrorToSlack).toHaveBeenCalledTimes(1);
    expect(mockReportErrorToSlack).toHaveBeenCalledWith(
      'uncaught',
      'boom de verdad',
      expect.anything()
    );
  });
});

describe('initSentry — ignoreErrors incluye el ruido del app nativo', () => {
  it('pasa los patrones nativos + AbortError a Sentry.init', () => {
    initSentry({
      dsn: 'https://pub@o1.ingest.sentry.io/1',
      appName: 'catalogohoy',
    });
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreErrors: expect.arrayContaining([
          'WKWebView was deallocated',
          'Error invoking jsReceiveMessages',
          'Java bridge method invocation error',
          'window.webkit.messageHandlers',
          'The operation was aborted',
        ]),
      })
    );
  });
});

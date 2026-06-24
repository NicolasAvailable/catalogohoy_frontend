// DSNs de Sentry. Son PÚBLICOS (van embebidos en el bundle del cliente, igual
// que la key de PostHog) — no son secretos. Pegá acá los DSN de cada proyecto.
//   - sentryDsnCatalogohoy → proyecto de la app catalogohoy
//   - sentryDsnAuth        → proyecto de la app authentication
// Si quedan vacíos, Sentry no se inicializa (ver initSentry en core).
export const sentryEnvironment = {
  sentryDsnCatalogohoy:
    'https://5f2df583248c1661aed0032eef0e7b2d@o4511618295332864.ingest.us.sentry.io/4511618305359872',
  sentryDsnAuth:
    'https://f65ab711d12d4cb06cf013f0d6f241af@o4511618295332864.ingest.us.sentry.io/4511618396323840',
  // Performance (tracing): % de transacciones muestreadas.
  sentryTracesSampleRate: 0.1,
  // Session Replay: 10% de sesiones normales, 100% de las que tienen error.
  sentryReplaysSessionSampleRate: 0.1,
  sentryReplaysOnErrorSampleRate: 1.0,
};

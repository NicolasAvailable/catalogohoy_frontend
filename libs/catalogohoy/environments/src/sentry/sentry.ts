// DSNs de Sentry. Son PÚBLICOS (van embebidos en el bundle del cliente, igual
// que la key de PostHog) — no son secretos. Un proyecto por app en la org
// `catalogohoy-w0` (o4512116099776512):
//   - sentryDsnCatalogohoy → proyecto `admin-dashboard`
//   - sentryDsnAuth        → proyecto `authentication`
//   - sentryDsnInternal    → proyecto `internal`
// Si quedan vacíos, Sentry no se inicializa (ver initSentry en core).
export const sentryEnvironment = {
  sentryDsnCatalogohoy:
    'https://ae3b08425b8d9e802b849af051e4500a@o4512116099776512.ingest.us.sentry.io/4512116141654016',
  sentryDsnAuth:
    'https://5eeeef79ccf2dff60765730ad13e197f@o4512116099776512.ingest.us.sentry.io/4512116141719552',
  sentryDsnInternal:
    'https://6b35ce449f1e15458d4029591baf4113@o4512116099776512.ingest.us.sentry.io/4512116141785088',
  // Performance (tracing): % de transacciones muestreadas.
  sentryTracesSampleRate: 0.1,
  // Session Replay: 10% de sesiones normales, 100% de las que tienen error.
  sentryReplaysSessionSampleRate: 0.1,
  sentryReplaysOnErrorSampleRate: 1.0,
};

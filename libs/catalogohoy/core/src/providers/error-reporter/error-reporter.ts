import { isDevMode } from '@angular/core';
import { toast } from 'ngx-sonner';
import { SupabaseClientProvider } from '../supabase/supabase';

/**
 * Telemetría de errores hacia el canal de Slack de errores (edge function
 * `notify-error`, mismo canal que los eventos de import). Dos ganchos
 * centrales, ambos enchufados por `provideSentry()`:
 *
 * 1. `patchToastErrorReporting()` — envuelve `toast.error` de ngx-sonner UNA
 *    vez al iniciar la app: cada error que un componente le muestra al
 *    usuario (~90 call sites) se reporta sin tocar ningún call site.
 * 2. `reportErrorToSlack('uncaught', …)` — lo llama el ErrorHandler global
 *    (ChunkAwareErrorHandler) para los errores no manejados, además de
 *    reportarlos a Sentry.
 *
 * Best-effort SIEMPRE: nunca bloquea ni rompe la app; en dev no reporta.
 * Anti-ruido: dedupe por mensaje + tope por sesión.
 */

const reportedKeys = new Set<string>();
let sentThisSession = 0;
const MAX_REPORTS_PER_SESSION = 15;

/** Ruido no accionable que NO va a Slack (Sentry lo sigue viendo por su
 *  propio canal). "Script error." es el mensaje ENMASCARADO que da el
 *  navegador para errores de scripts de otro origen sin CORS (pixels de
 *  Meta/GA/TikTok en los storefronts): no trae información por diseño.
 *  El resto es la misma lista que Sentry ignora en su init. */
const NOISE_PATTERNS =
  /Script error|Java object is gone|Error invoking postMessage|ResizeObserver loop/i;

/** Fingerprint del build (main-XXXX.js) — mismo truco que AppVersionService.
 *  Cambia con cada deploy: permite correlacionar errores con deploys. */
let cachedVersion: string | null | undefined;
function buildVersion(): string | null {
  if (cachedVersion !== undefined) return cachedVersion;
  try {
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="main-"]'
    );
    cachedVersion = script?.src.match(/main-[A-Z0-9]+\.js/)?.[0] ?? null;
  } catch {
    cachedVersion = null;
  }
  return cachedVersion;
}

export function reportErrorToSlack(
  source: 'toast' | 'uncaught' | string,
  message: string,
  detail?: string
): void {
  try {
    if (isDevMode()) return;
    const text = String(message ?? 'error desconocido').slice(0, 500);
    if (source === 'uncaught' && NOISE_PATTERNS.test(text)) return;
    const key = `${source}:${text}`;
    if (reportedKeys.has(key) || sentThisSession >= MAX_REPORTS_PER_SESSION) {
      return;
    }
    reportedKeys.add(key);
    sentThisSession++;

    const slug = localStorage.getItem('slug') ?? '';
    void SupabaseClientProvider.getInstance()
      .functions.invoke('notify-error', {
        body: {
          source,
          message: text,
          detail: detail?.slice(0, 1000),
          slug,
          url: location.href.slice(0, 300),
          version: buildVersion(),
        },
      })
      .catch(() => undefined);
  } catch {
    // Telemetría best-effort: cualquier fallo se ignora.
  }
}

/** Envuelve `toast.error` para reportar todo error mostrado al usuario.
 *  Idempotente (una sola vez aunque las dos apps compartan el bundle). */
export function patchToastErrorReporting(): void {
  try {
    const patchable = toast as unknown as Record<string, unknown>;
    if (patchable['__errorReportPatched']) return;
    patchable['__errorReportPatched'] = true;

    const original = toast.error;
    patchable['error'] = (message: unknown, data?: unknown) => {
      try {
        if (typeof message === 'string') {
          reportErrorToSlack('toast', message);
        }
      } catch {
        // noop
      }
      return (original as (m: unknown, d?: unknown) => unknown)(message, data);
    };
  } catch {
    // noop
  }
}

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

export function reportErrorToSlack(
  source: 'toast' | 'uncaught' | string,
  message: string,
  detail?: string
): void {
  try {
    if (isDevMode()) return;
    const text = String(message ?? 'error desconocido').slice(0, 500);
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

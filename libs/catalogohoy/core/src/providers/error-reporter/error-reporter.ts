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
 *
 *  Además filtramos código AJENO inyectado en la página del visitante, que
 *  no es nuestro bundle (aparece como `global code@…/:1:xx`, línea 1 del
 *  documento): extensiones de wallet cripto (`window.ethereum` /
 *  `selectedAddress`), el modo lector de Firefox / Firefox iOS (`__firefox__`),
 *  y scripts de extensiones (chrome-/moz-/safari-extension). Nada de esto es
 *  un bug de la app. El resto es la misma lista que Sentry ignora en su init. */
const NOISE_PATTERNS =
  /Script error|Java object is gone|Error invoking postMessage|ResizeObserver loop|WKWebView was deallocated|Error invoking jsReceiveMessages|Java bridge method invocation error|window\.webkit\.messageHandlers|The operation was aborted|window\.ethereum|selectedAddress|__firefox__|evmAsk|__gCrWeb|chrome-extension|moz-extension|safari-web-extension|web3|solana\.|ethereum|zaloJSV2|vid_mate|_AutofillCallbackHandler|instantSearchSDK/i;

/** Toasts que son validación/UX esperada (no bugs): no se reportan a Slack
 *  aunque se le muestren al usuario. P. ej. el carrito avisando que un producto
 *  llegó a su límite de stock — es el guardrail funcionando, no un error. */
const TOAST_NOISE =
  /No hay más stock disponible|No more stock available|plus de stock disponible|mais estoque disponível/i;

/** Errores ESPERADOS que se le muestran al usuario: no son fallas de la app,
 *  así que no van al canal de errores (sólo deben llegar errores reales).
 *  Cubre es/en/pt/fr porque el toast llega ya traducido. Tres familias:
 *  - Login/registro: credenciales inválidas, usuario ya existe, contraseña
 *    débil, tope de emails, enlace de verificación vencido.
 *  - Límites del plan y créditos: "llegaste al límite", "mejora tu plan",
 *    funciones de planes pagos, créditos insuficientes.
 *  - Validación de lo que cargó el usuario: campos obligatorios, formato
 *    inválido, imagen ilegible (JPG/PNG/WEBP), sin permiso, sin conexión.
 *  Mantener en sync con EXPECTED_USER_ERRORS de la edge `notify-error`. */
export const EXPECTED_USER_ERRORS = new RegExp(
  [
    // Login / registro
    'contraseña son inv', 'email or password is invalid', 'e-mail ou a senha',
    'mot de passe est invalide', 'invalid login credentials',
    'email not confirmed', 'usuario ya existe', 'user already exists',
    'usuário já existe', 'utilisateur existe déjà', 'contraseña debe',
    'password must', 'password should', 'senha deve', 'mot de passe doit',
    'límite emails', 'enlace de verificación expiró',
    // Límites del plan / créditos
    'l[ií]mite', 'limit of', 'limit reached', "plan's limit", 'plan limit',
    'mejor[aá] (tu|el) plan', 'mejora tu plan', 'actualiza tu plan',
    'upgrade your plan', 'upgrade do plano', 'melhore seu plano',
    'améliorez votre plan', 'planes pagos', 'paid plans', 'PLAN_LIMIT',
    'disponible en el plan', 'available on the', 'tu plan ha expirado',
    'no te alcanzan', 'cr[eé]ditos? insuficientes', 'not enough credits',
    'insufficient credits', 'sin cr[eé]ditos', 'compra más créditos',
    'buy more credits', 'compre mais créditos', 'achetez plus de crédits',
    // Validación / permisos / conexión del usuario
    'obligatori', 'obrigatóri', 'requerid', 'is required', 'no es válid',
    'is not valid', 'não é válid', "n'est pas valide", 'JPG, PNG',
    'No pudimos leer esta imagen', 'No tienes permiso', "don't have permission",
    'não tem permissão', "n'avez pas la permission", 'completa los campos',
    'Verifica tu conexi', 'check your connection',
  ].join('|'),
  'i'
);

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
    if (
      source === 'toast' &&
      (TOAST_NOISE.test(text) || EXPECTED_USER_ERRORS.test(text))
    ) {
      return;
    }
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

// Persiste la ATRIBUCIÓN de tráfico (de qué red/canal vino el visitante) como
// cookie compartida entre subdominios de catalogohoy. Se setea acá
// (catalogohoy.com) y la lee apps/authentication cuando el usuario llega a
// auth.catalogohoy.com a registrarse → así el registro queda atribuido a
// TikTok / Instagram / Threads / X / Google, etc.
//
// Por qué cookie y no localStorage: localStorage es per-origin —
// catalogohoy.com ≠ auth.catalogohoy.com → se pierde el handshake.
//
// First-touch: si ya hay una cookie, NO la pisamos (preservamos la PRIMERA
// fuente que trajo al visitante, que es la que vale para atribuir).
//
// Espeja el patrón de referral-cookie.ts (mismo dominio, mismo criterio).

const COOKIE_NAME = "chy_attr";
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 días

function getCookieDomain(): string | null {
  const host = window.location.hostname;
  if (host === "catalogohoy.com" || host.endsWith(".catalogohoy.com")) {
    return ".catalogohoy.com";
  }
  if (host === "catalogohoy.localhost" || host.endsWith(".catalogohoy.localhost")) {
    return ".catalogohoy.localhost";
  }
  return null;
}

function alreadyCaptured(): boolean {
  return /(?:^|;\s*)chy_attr=/.test(document.cookie);
}

// Clasifica el referrer en una fuente conocida cuando NO hay utm_source
// (p. ej. una visita orgánica desde Google, o social que sí pasa referrer).
// Los navegadores in-app de WhatsApp/Instagram suelen borrar el referrer → por
// eso el utm etiquetado es el camino confiable; esto es el mejor esfuerzo.
function classifyReferrer(): { s: string; m: string } | null {
  const ref = document.referrer;
  if (!ref) return null;
  let host: string;
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    return null;
  }
  // Referrer interno (el propio landing / catálogos) → no es una fuente.
  if (host === "catalogohoy.com" || host.endsWith(".catalogohoy.com")) return null;

  const map: [RegExp, { s: string; m: string }][] = [
    [/(^|\.)google\./, { s: "google", m: "organic" }],
    [/(^|\.)bing\./, { s: "bing", m: "organic" }],
    [/duckduckgo\./, { s: "duckduckgo", m: "organic" }],
    [/(^|\.)(instagram\.com|l\.instagram\.com|lm\.instagram\.com)/, { s: "instagram", m: "social" }],
    [/(^|\.)tiktok\./, { s: "tiktok", m: "social" }],
    [/(t\.co|twitter\.com|x\.com)/, { s: "x", m: "social" }],
    [/threads\.(net|com)/, { s: "threads", m: "social" }],
    [/(^|\.)(facebook\.com|l\.facebook\.com|fb\.com|m\.facebook\.com)/, { s: "facebook", m: "social" }],
    [/(youtube\.com|youtu\.be)/, { s: "youtube", m: "social" }],
    [/(linkedin\.com|lnkd\.in)/, { s: "linkedin", m: "social" }],
  ];
  for (const [re, val] of map) {
    if (re.test(host)) return val;
  }
  // Otro sitio externo → referral con el dominio como fuente.
  return { s: host.replace(/^www\./, "").slice(0, 60), m: "referral" };
}

export function captureAttributionFromUrl(): void {
  // First-touch: respetamos la primera fuente registrada.
  if (alreadyCaptured()) return;

  const params = new URLSearchParams(window.location.search);
  const clean = (v: string | null) =>
    (v ?? "").trim().replace(/[<>"']/g, "").slice(0, 60);

  let s = clean(params.get("utm_source"));
  let m = clean(params.get("utm_medium"));
  let c = clean(params.get("utm_campaign"));

  // Sin utm_source explícito, intentamos deducirlo del referrer.
  if (!s) {
    const derived = classifyReferrer();
    if (!derived) return; // Directo / desconocido → no seteamos nada.
    s = derived.s;
    m = m || derived.m;
  }

  const value = encodeURIComponent(JSON.stringify({ s, m, c }));

  const parts = [
    `${COOKIE_NAME}=${value}`,
    "path=/",
    `max-age=${MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];

  const domain = getCookieDomain();
  if (domain) parts.push(`domain=${domain}`);

  // Secure obligatorio en prod (https), prohibido en localhost (http).
  if (window.location.protocol === "https:") parts.push("Secure");

  document.cookie = parts.join("; ");
}

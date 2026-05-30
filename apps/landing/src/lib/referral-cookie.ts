// Persiste el código de referido como cookie compartida entre subdominios
// de catalogohoy. Se setea acá (catalogohoy.com) y la lee apps/authentication
// cuando el usuario llega a auth.catalogohoy.com.
//
// Por qué cookie y no localStorage: localStorage es per-origin —
// catalogohoy.com ≠ auth.catalogohoy.com → se pierde el handshake.

const COOKIE_NAME = "chy_ref";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 días

// Match cualquier dominio dev tipo `*.catalogohoy.localhost` o el público.
// En localhost-puro (sin subdominio) no podemos setear domain — quedará per-origin
// pero al menos sirve para probar el flujo en una sola app.
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

export function captureReferralFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return;

  // Normalizamos: BCV-style uppercase, max 7 chars, alfanumérico.
  const code = ref.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (!code) return;

  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(code)}`,
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

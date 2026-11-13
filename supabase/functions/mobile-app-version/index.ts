import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// -----------------------------------------------------------------------------
// mobile-app-version — versión PUBLICADA de la app en cada tienda.
//
// POST { platform: "ios" | "android" }
//   -> { latestVersion: string | null, storeUrl: string, source: "store" | "none" }
//
// La app nativa la consulta al arrancar para mostrar el aviso de "nueva
// actualización" (AppUpdateService / AppUpdateGate). Lee la versión que está
// EN VIVO en la tienda, así el aviso sale solo en cada release —cuando la
// versión ya se puede descargar— sin tocar nada a mano:
//   · iOS: iTunes Lookup API (oficial).
//   · Android: ficha pública de Google Play (no hay API pública de versión).
// Si la tienda no responde o cambia el formato devuelve latestVersion null y
// la app cae a `mobile_app_config` (comparación por build).
//
// Cache en memoria de 30 min por plataforma.
// -----------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUNDLE_ID = "com.catalogohoy.app";
const IOS_STORE_URL = "https://apps.apple.com/app/id6817059692";
const ANDROID_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.catalogohoy.app";

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { version: string | null; expiresAt: number }>();

const VERSION_RE = /^\d+(\.\d+){1,3}$/;

async function iosLiveVersion(): Promise<string | null> {
  // `t` evita la caché del CDN de Apple, que puede tardar horas en refrescar.
  const res = await fetch(
    `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}&t=${Date.now()}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const version = data?.results?.[0]?.version;
  return typeof version === "string" && VERSION_RE.test(version)
    ? version
    : null;
}

async function androidLiveVersion(): Promise<string | null> {
  const res = await fetch(`${ANDROID_STORE_URL}&hl=en&gl=US`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CatalogoHoyVersionCheck)" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  // La ficha trae la versión actual como [[["1.0.22"]] dentro de sus datos.
  const match = html.match(/\[\[\["(\d+(?:\.\d+){1,3})"\]\]/);
  return match ? match[1] : null;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let platform = "";
  try {
    platform = String((await req.json())?.platform ?? "");
  } catch {
    /* body vacío */
  }
  if (platform !== "ios" && platform !== "android") {
    return json({ error: "platform debe ser ios o android" }, 400);
  }

  const storeUrl = platform === "ios" ? IOS_STORE_URL : ANDROID_STORE_URL;
  const cached = cache.get(platform);
  if (cached && cached.expiresAt > Date.now()) {
    return json({
      latestVersion: cached.version,
      storeUrl,
      source: cached.version ? "store" : "none",
    });
  }

  let version: string | null = null;
  try {
    version = platform === "ios"
      ? await iosLiveVersion()
      : await androidLiveVersion();
  } catch (err) {
    console.error("[mobile-app-version] lookup failed", platform, err);
  }
  // Un fallo se cachea poco (2 min) para reintentar pronto.
  cache.set(platform, {
    version,
    expiresAt: Date.now() + (version ? CACHE_TTL_MS : 2 * 60 * 1000),
  });

  return json({ latestVersion: version, storeUrl, source: version ? "store" : "none" });
});

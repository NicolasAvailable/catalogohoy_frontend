import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// meta-catalog — administración del Commerce Catalog del tenant (CAT-64).
// Requiere conexión previa vía meta-oauth (token en meta_business_connections).
//
//   POST { tenantId, action, ... }  (JWT del panel + membresía del tenant)
//     - status:          estado del catálogo (product_count + última ingesta)
//                        + estado del pixel/CAPI
//     - select_business: { businessId } — elegir Business cuando hay varios;
//                        resetea catálogo/feed (pertenecen al Business anterior)
//     - provision:       crea el catálogo en el Business + registra el feed CSV
//                        (schedule diario) + dispara la primera ingesta
//     - sync_now:        re-ingesta inmediata del feed
//     - provision_pixel: CAT-65 — adopta (o crea) el pixel del Business y llena
//                        la MISMA cañería de la config manual: meta_pixel_id en
//                        tenant_ecommerce_config (storefront) + token OAuth en
//                        meta_capi_credentials (CAPI server-side). Además vincula
//                        el pixel al Commerce Catalog para dynamic ads.
//
// El feed es meta-catalog-feed?t=<tenantId>&sig=<HMAC(FB_APP_SECRET,"feed|id")>.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const FB_APP_SECRET = Deno.env.get("FB_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET") ?? "";
const GRAPH = "https://graph.facebook.com/v23.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function feedSig(tenantId) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(FB_APP_SECRET || "dev-secret"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`feed|${tenantId}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function graph(path, token, init = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? `Graph error ${res.status}`;
    console.error(`[meta-catalog] ${path}:`, JSON.stringify(json?.error ?? json));
    const err = new Error(msg);
    err.fb = json?.error ?? null; // subcódigos p/errores accionables (p.ej. ToS)
    throw err;
  }
  return json;
}

/** Estado resumido del catálogo: cuántos productos ve Meta y cómo salió la
 *  última ingesta del feed. */
async function catalogStatus(conn) {
  if (!conn.catalog_id) return { provisioned: false };
  const out = { provisioned: true, catalogId: conn.catalog_id };
  try {
    const cat = await graph(`${conn.catalog_id}?fields=product_count,name`, conn.access_token);
    out.productCount = cat.product_count ?? 0;
    out.catalogName = cat.name ?? null;
  } catch { out.productCount = null; }
  const feedId = conn.metadata?.feed_id;
  if (feedId) {
    try {
      const uploads = await graph(
        `${feedId}/uploads?limit=1&fields=start_time,end_time,error_count,warning_count`,
        conn.access_token,
      );
      const last = (uploads.data ?? [])[0] ?? null;
      if (last) {
        out.lastSync = {
          startTime: last.start_time ?? null,
          endTime: last.end_time ?? null,
          errorCount: last.error_count ?? 0,
          warningCount: last.warning_count ?? 0,
        };
      }
    } catch { /* la ingesta puede no existir aún; el estado base alcanza */ }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

  let body;
  try { body = await req.json(); } catch { return jsonResponse({ success: false, error: "Invalid JSON" }, 400); }
  const tenantId = Number(body.tenantId);
  const action = String(body.action ?? "");
  if (!tenantId || !action) return jsonResponse({ success: false, error: "Missing tenantId/action" }, 400);

  const { data: member } = await admin
    .from("users").select("id, users_tenants!inner(tenant_id)")
    .eq("auth_user_id", user.id).eq("users_tenants.tenant_id", tenantId).maybeSingle();
  if (!member) return jsonResponse({ success: false, error: "Forbidden" }, 403);

  const { data: conn } = await admin
    .from("meta_business_connections").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (!conn || conn.status !== "connected" || !conn.access_token) {
    return jsonResponse({ success: false, error: "Meta no está conectado" }, 409);
  }

  const feedUrl =
    `${SUPABASE_URL}/functions/v1/meta-catalog-feed?t=${tenantId}&sig=${await feedSig(tenantId)}`;

  /** Estado del pixel/CAPI leyendo la misma config que usa el runtime (sin
   *  llamadas a Graph): pixel del storefront + credenciales del CAPI. */
  async function pixelStatus() {
    const [{ data: cfg }, { data: capi }] = await Promise.all([
      admin.from("tenant_ecommerce_config").select("meta_pixel_id").eq("tenant_id", tenantId).maybeSingle(),
      admin.from("meta_capi_credentials").select("enabled").eq("tenant_id", tenantId).maybeSingle(),
    ]);
    const pixelId = (cfg?.meta_pixel_id ?? "").trim() || null;
    return {
      pixelId,
      pixelAuto: !!pixelId && pixelId === conn.pixel_id,
      capiOk: !!capi && capi.enabled !== false,
    };
  }

  try {
    switch (action) {
      case "status":
        return jsonResponse({
          success: true,
          feedUrl,
          ...(await catalogStatus(conn)),
          ...(await pixelStatus()),
        });

      case "select_business": {
        const businessId = String(body.businessId ?? "");
        const businesses = conn.metadata?.businesses ?? [];
        const chosen = businesses.find((b) => b.id === businessId);
        if (!chosen) return jsonResponse({ success: false, error: "Business inválido" }, 400);
        if (chosen.id === conn.business_id) return jsonResponse({ success: true });
        // El catálogo/feed pertenecen al Business anterior: se re-aprovisiona.
        const metadata = { ...(conn.metadata ?? {}) };
        delete metadata.feed_id;
        await admin.from("meta_business_connections").update({
          business_id: chosen.id,
          business_name: chosen.name,
          catalog_id: null,
          metadata,
          updated_at: new Date().toISOString(),
        }).eq("tenant_id", tenantId);
        return jsonResponse({ success: true });
      }

      case "provision": {
        if (!conn.business_id) {
          return jsonResponse({ success: false, error: "No hay un Business de Meta seleccionado" }, 409);
        }
        let catalogId = conn.catalog_id;
        if (!catalogId) {
          const { data: tenant } = await admin
            .from("tenants").select("name, slug").eq("id", tenantId).maybeSingle();
          const created = await graph(`${conn.business_id}/owned_product_catalogs`, conn.access_token, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ name: `${tenant?.name ?? tenant?.slug ?? "Catálogo"} · CatalogoHoy` }),
          });
          catalogId = created.id;
        }
        let feedId = conn.metadata?.feed_id ?? null;
        if (!feedId) {
          const feed = await graph(`${catalogId}/product_feeds`, conn.access_token, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              name: "CatalogoHoy — feed diario",
              schedule: JSON.stringify({ interval: "DAILY", url: feedUrl, hour: 6 }),
            }),
          });
          feedId = feed.id;
        }
        // Primera ingesta inmediata (sin esperar el schedule).
        await graph(`${feedId}/uploads`, conn.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ url: feedUrl }),
        });
        // Si el pixel ya estaba aprovisionado, vincularlo al catálogo nuevo
        // (dynamic ads) — así el orden catálogo/pixel no importa.
        if (conn.pixel_id) {
          try {
            await graph(`${catalogId}/external_event_sources`, conn.access_token, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ external_event_sources: JSON.stringify([conn.pixel_id]) }),
            });
          } catch { /* el vínculo se puede rehacer desde provision_pixel */ }
        }
        const metadata = { ...(conn.metadata ?? {}), feed_id: feedId };
        await admin.from("meta_business_connections").update({
          catalog_id: catalogId,
          metadata,
          updated_at: new Date().toISOString(),
        }).eq("tenant_id", tenantId);
        return jsonResponse({
          success: true,
          ...(await catalogStatus({ ...conn, catalog_id: catalogId, metadata })),
        });
      }

      case "provision_pixel": {
        if (!conn.business_id) {
          return jsonResponse({ success: false, error: "No hay un Business de Meta seleccionado" }, 409);
        }
        const { data: cfg } = await admin
          .from("tenant_ecommerce_config").select("meta_pixel_id").eq("tenant_id", tenantId).maybeSingle();
        const manualId = (cfg?.meta_pixel_id ?? "").trim();

        let pixel;
        try {
          const owned = await graph(`${conn.business_id}/adspixels?fields=id,name&limit=50`, conn.access_token);
          const pixels = owned.data ?? [];
          // Si hay un pixel puesto a mano que NO pertenece a este Business, no lo
          // pisamos (romperíamos el tracking/CAPI actual del comercio).
          if (manualId && !pixels.some((p) => p.id === manualId)) {
            return jsonResponse({
              success: false,
              error: "Ya tenés un Píxel configurado a mano que no pertenece a este portfolio. Quitalo primero o conectá el portfolio correcto.",
            }, 409);
          }
          // Adoptar: el manual (si es del Business) > el primero existente > crear.
          pixel = pixels.find((p) => p.id === manualId) ?? pixels[0] ?? null;
          if (!pixel) {
            const { data: tenant } = await admin
              .from("tenants").select("name, slug").eq("id", tenantId).maybeSingle();
            pixel = await graph(`${conn.business_id}/adspixels`, conn.access_token, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ name: `${tenant?.name ?? tenant?.slug ?? "Pixel"} · CatalogoHoy` }),
            });
          }
        } catch (err) {
          // 1784018: el Business nunca aceptó los Términos del Píxel — es un
          // click único del dueño; devolvemos el link directo para destrabar.
          if (err?.fb?.error_subcode === 1784018) {
            return jsonResponse({
              success: false,
              code: "pixel_tos",
              tosUrl: `https://business.facebook.com/ads/manage/customaudiences/tos/?business_id=${conn.business_id}`,
              error: "Tu portfolio de Meta todavía no aceptó los Términos del Píxel. Aceptalos (un solo click) y volvé a intentar.",
            }, 409);
          }
          throw err;
        }

        // Vincular pixel ↔ catálogo (dynamic ads); si aún no hay catálogo, se
        // vincula cuando se publique (provision lo reintenta — ver abajo).
        if (conn.catalog_id) {
          await graph(`${conn.catalog_id}/external_event_sources`, conn.access_token, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ external_event_sources: JSON.stringify([pixel.id]) }),
          });
        }

        // Misma cañería que la config manual: el storefront lee meta_pixel_id y
        // el CAPI lee meta_capi_credentials — nada más que tocar.
        const nowIso = new Date().toISOString();
        await admin.from("tenant_ecommerce_config")
          .update({ meta_pixel_id: pixel.id, updated_at: nowIso })
          .eq("tenant_id", tenantId);
        await admin.from("meta_capi_credentials").upsert({
          tenant_id: tenantId,
          access_token: conn.access_token,
          enabled: true,
          updated_at: nowIso,
        }, { onConflict: "tenant_id" });
        await admin.from("meta_business_connections")
          .update({ pixel_id: pixel.id, updated_at: nowIso })
          .eq("tenant_id", tenantId);

        return jsonResponse({ success: true, pixelId: pixel.id, pixelAuto: true, capiOk: true });
      }

      case "sync_now": {
        const feedId = conn.metadata?.feed_id;
        if (!conn.catalog_id || !feedId) {
          return jsonResponse({ success: false, error: "El catálogo no está publicado todavía" }, 409);
        }
        await graph(`${feedId}/uploads`, conn.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ url: feedUrl }),
        });
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ success: false, error: `Acción desconocida: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[meta-catalog] error", action, err);
    return jsonResponse({ success: false, error: err.message ?? "Error con la API de Meta" }, 502);
  }
});

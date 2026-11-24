// Conversions API de Meta para el PÍXEL PROPIO de CatalogoHoy (el funnel de la
// plataforma: registro, prueba gratis, pago de plan). Distinto de la edge fn
// `meta-capi`, que manda los pedidos de cada TIENDA al píxel de esa tienda.
//
// Token: secret META_PLATFORM_CAPI_TOKEN (Administrador de eventos → píxel →
// Configuración → "Generar token de acceso"). Píxel: META_PLATFORM_PIXEL_ID
// (default el del environment de la app). Sin token = no-op silencioso, así el
// código puede ir a prod antes de cargar el secret.
//
// Nunca lanza ni demora el flujo que lo llama (timeout corto): un fallo de Meta
// jamás puede romper un webhook de pago.
//
// Dedup: el mismo `eventId` que manda el navegador con fbq(..., {eventID}) →
// Meta cuenta una sola conversión.

const META_API_VERSION = Deno.env.get("META_API_VERSION") ?? "v21.0";
const DEFAULT_PIXEL_ID = "965941839155879"; // mismo píxel que la landing y la cuenta publicitaria
const TIMEOUT_MS = 4000;

export interface PlatformEvent {
  eventName: "CompleteRegistration" | "StartTrial" | "Purchase" | "Subscribe";
  eventId: string;
  /** "website" (navegador / checkout web) o "other" (compra en la app nativa). */
  actionSource?: "website" | "other" | "system_generated";
  eventTime?: number; // unix seconds; default ahora
  sourceUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null; // ISO-2
  externalId?: string | null; // auth uuid del dueño (estable entre eventos)
  clientIp?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  value?: number | null;
  currency?: string | null;
  contentName?: string | null; // plan
  purchaseSource?: "stripe" | "pago_movil_whatsapp" | "app_store" | "google_play" | "revenuecat_other";
  predictedLtv?: number | null;
}

async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export function platformCapiConfigured(): boolean {
  return !!Deno.env.get("META_PLATFORM_CAPI_TOKEN");
}

/** Arma el user_data hasheado como exige Meta. Exportado para tests. */
export async function buildUserData(e: PlatformEvent): Promise<Record<string, unknown>> {
  const ud: Record<string, unknown> = {};
  const email = norm(e.email);
  if (email.includes("@")) ud["em"] = [await sha256(email)];
  const phone = (e.phone ?? "").replace(/\D/g, "");
  if (phone.length >= 8) ud["ph"] = [await sha256(phone)];
  const fn = norm(e.firstName).split(/\s+/)[0];
  if (fn) ud["fn"] = [await sha256(fn)];
  const ln = norm(e.lastName).split(/\s+/)[0];
  if (ln) ud["ln"] = [await sha256(ln)];
  const country = norm(e.country);
  if (/^[a-z]{2}$/.test(country)) ud["country"] = [await sha256(country)];
  if (e.externalId) ud["external_id"] = [await sha256(String(e.externalId))];
  if (e.clientIp) ud["client_ip_address"] = e.clientIp;
  if (e.clientUserAgent) ud["client_user_agent"] = e.clientUserAgent;
  if (e.fbp) ud["fbp"] = e.fbp;
  if (e.fbc) ud["fbc"] = e.fbc;
  return ud;
}

/** Manda un evento al píxel propio. Devuelve un resumen (para logs), nunca lanza. */
export async function sendPlatformEvent(e: PlatformEvent): Promise<Record<string, unknown>> {
  const token = Deno.env.get("META_PLATFORM_CAPI_TOKEN");
  if (!token) return { skipped: true, reason: "sin META_PLATFORM_CAPI_TOKEN" };
  const pixelId = Deno.env.get("META_PLATFORM_PIXEL_ID") || DEFAULT_PIXEL_ID;
  const testCode = Deno.env.get("META_PLATFORM_TEST_EVENT_CODE");

  try {
    const customData: Record<string, unknown> = {};
    if (e.value != null && Number.isFinite(e.value)) customData["value"] = Math.round(e.value * 100) / 100;
    if (e.currency) customData["currency"] = e.currency.toUpperCase();
    if (e.contentName) customData["content_name"] = e.contentName;
    if (e.eventName === "Purchase" && e.purchaseSource) customData["purchase_source"] = e.purchaseSource;
    if (e.predictedLtv != null && Number.isFinite(e.predictedLtv)) customData["predicted_ltv"] = e.predictedLtv;

    const actionSource = e.actionSource ?? "website";
    const body = {
      data: [{
        event_name: e.eventName,
        event_time: e.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: actionSource,
        ...(e.sourceUrl ? { event_source_url: e.sourceUrl } : {}),
        user_data: await buildUserData(e),
        custom_data: customData,
      }],
      ...(testCode ? { test_event_code: testCode } : {}),
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal },
    ).finally(() => clearTimeout(timer));
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[meta-platform-capi]", e.eventName, res.status, out?.error?.message);
      return { ok: false, status: res.status, error: out?.error?.message ?? "Meta error" };
    }
    if (e.eventName === "Purchase" && e.purchaseSource && out?.events_received === 1) {
      console.info("[meta-platform-capi] Purchase recibido", { event_id: e.eventId, purchase_source: e.purchaseSource });
    }
    return { ok: true, events_received: out?.events_received ?? null };
  } catch (err) {
    console.warn("[meta-platform-capi]", e.eventName, String(err));
    return { ok: false, error: String(err) };
  }
}

/** Datos del dueño de un tenant para el matching (email, teléfono, nombre, país, auth uuid). */
export async function fetchOwnerMatchData(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: number,
): Promise<Pick<PlatformEvent, "email" | "phone" | "firstName" | "lastName" | "country" | "externalId">> {
  try {
    const { data } = await admin
      .from("users_tenants")
      .select("users!inner(email, phone, name, last_name, country_code, auth_user_id)")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const u = (data as any)?.users ?? null;
    if (!u) return {};
    return {
      email: u.email ?? null,
      phone: u.phone ?? null,
      firstName: u.name ?? null,
      lastName: u.last_name ?? null,
      country: u.country_code ?? null,
      externalId: u.auth_user_id ?? null,
    };
  } catch {
    return {};
  }
}

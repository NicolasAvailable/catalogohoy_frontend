import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";
import { uploadToS3 } from "../_shared/s3.ts";

// =============================================================================
// wa-store-bot — Bot de WhatsApp para comerciantes (CAT-78, v1).
//
// El dueño de una tienda escribe al número de AVISOS de la plataforma y
// gestiona su catálogo conversando: crea/edita productos (con fotos), ajusta
// precios, crea categorías y consulta órdenes. Un agente (Claude + tools
// scopeadas al tenant) interpreta cada mensaje.
//
// Dos entradas:
//   1. Interna (wa-webhook): header `x-internal-secret` = service-role key.
//      Body { message, profileName } con el mensaje crudo de Meta. Responde 202
//      al toque y procesa en background (EdgeRuntime.waitUntil).
//   2. Panel (JWT del usuario): { action: 'status' | 'create_code' | 'unlink',
//      tenantId, linkId? }. Genera el código de vinculación (6 dígitos, 15 min)
//      que el dueño manda por WhatsApp ("Vincular 123456").
//
// Seguridad: un teléfono queda ligado a UNA tienda solo con un código generado
// por un owner/admin logueado. Toda tool filtra por ese tenant_id.
// Gating v1: WA_BOT_TENANTS (lista de ids separada por coma, "*" = todas).
// Costo: 1 crédito de IA por mensaje procesado por el agente.
// Deploy con verify_jwt=false (auth propia en ambas entradas).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")?.trim() ?? "";
const NOTIFY_PNID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")?.trim() ?? "";
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const FAL_KEY = Deno.env.get("FAL_KEY");
const MODEL = Deno.env.get("WA_BOT_MODEL") ?? "claude-opus-5-5";
const ALLOWED_TENANTS = (Deno.env.get("WA_BOT_TENANTS") ?? "6").split(",").map((s) => s.trim());
const CREDIT_COST = 1;
const HISTORY_MAX = 16;
const MAX_AGENT_STEPS = 8;
const PHOTO_ACK_DELAY_MS = 5000;
const CODE_TTL_MIN = 15;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

const digits = (s: string) => (s ?? "").replace(/\D/g, "");
const tenantAllowed = (tenantId: number) =>
  ALLOWED_TENANTS.includes("*") || ALLOWED_TENANTS.includes(String(tenantId));

// ── WhatsApp (número de avisos) ─────────────────────────────────────────────
async function graph(path: string, body?: unknown) {
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error("[wa-store-bot] graph", path, res.status, JSON.stringify(data).slice(0, 300));
  return { ok: res.ok, data };
}

async function sendText(to: string, text: string) {
  // WhatsApp corta en 4096 caracteres.
  const body = text.trim().slice(0, 4000) || "👍";
  await graph(`${NOTIFY_PNID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: true },
  });
}

/** Marca el mensaje como leído y muestra "escribiendo…" mientras pensamos. */
async function markReadTyping(messageId: string) {
  if (!messageId) return;
  await graph(`${NOTIFY_PNID}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  });
}

let botPhoneCache: string | null = null;
async function botPhone(): Promise<string> {
  if (botPhoneCache) return botPhoneCache;
  const { data } = await graph(`${NOTIFY_PNID}?fields=display_phone_number`);
  botPhoneCache = digits(data?.display_phone_number ?? "");
  return botPhoneCache;
}

/** Descarga la media de Meta y la sube a S3. Devuelve la URL del CDN. */
async function storeMedia(mediaId: string, mime: string, prefix: string): Promise<string | null> {
  try {
    const { ok, data: meta } = await graph(mediaId);
    if (!ok || !meta?.url) return null;
    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
    if (!fileRes.ok) return null;
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    const type = (mime || meta.mime_type || "application/octet-stream").split(";")[0];
    const ext = type.split("/")[1] ?? "bin";
    const key = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return await uploadToS3(key, bytes, type);
  } catch (e) {
    console.error("[wa-store-bot] storeMedia", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function transcribe(audioUrl: string): Promise<string> {
  if (!FAL_KEY) return "";
  const res = await fetch("https://fal.run/fal-ai/whisper", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ audio_url: audioUrl, task: "transcribe" }),
  });
  if (!res.ok) return "";
  const out = (await res.json().catch(() => ({}))) as { text?: string };
  return (out.text ?? "").trim();
}

// ── Vínculo teléfono ↔ tienda ───────────────────────────────────────────────
interface Link {
  id: number;
  tenant_id: number;
  user_id: number;
  auth_user_id: string;
  phone: string;
}

async function getLink(phone: string): Promise<Link | null> {
  const { data } = await admin.from("wa_bot_links")
    .select("id, tenant_id, user_id, auth_user_id, phone").eq("phone", phone).maybeSingle();
  return (data as Link | null) ?? null;
}

async function tenantInfo(tenantId: number) {
  const { data } = await admin.from("tenants").select("name, slug, custom_domain").eq("id", tenantId).maybeSingle();
  const domain = data?.custom_domain?.trim() || (data?.slug ? `${data.slug}.catalogohoy.com` : "");
  return { name: data?.name ?? "tu tienda", url: domain ? `https://${domain}` : "" };
}

const WELCOME_HELP =
  "Puedes pedirme cosas como:\n" +
  "📸 Mandar una foto + \"Zapato rojo, $25, stock 10\" → creo el producto\n" +
  "✏️ \"El zapato rojo ahora cuesta $22\"\n" +
  "🏷️ \"Sube 10% todos los productos de la categoría Zapatos\"\n" +
  "📦 \"¿Qué órdenes tengo pendientes?\"\n" +
  "🎤 También entiendo notas de voz.";

async function linkWithCode(phone: string, code: string): Promise<boolean> {
  const { data: row } = await admin.from("wa_bot_link_codes")
    .select("code, tenant_id, user_id, auth_user_id, expires_at, used_at").eq("code", code).maybeSingle();
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return false;
  await admin.from("wa_bot_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code);
  await admin.from("wa_bot_links").upsert({
    phone, tenant_id: row.tenant_id, user_id: row.user_id, auth_user_id: row.auth_user_id,
    created_at: new Date().toISOString(),
  }, { onConflict: "phone" });
  // Cambiar de tienda reinicia la memoria de la conversación.
  await admin.from("wa_bot_sessions").upsert({
    phone, tenant_id: row.tenant_id, history: [], pending_photos: [], updated_at: new Date().toISOString(),
  }, { onConflict: "phone" });
  const t = await tenantInfo(row.tenant_id);
  await sendText(phone, `✅ ¡Listo! Este WhatsApp quedó conectado a *${t.name}*.\n\n${WELCOME_HELP}`);
  return true;
}

// ── Sesión (memoria corta) ──────────────────────────────────────────────────
interface Turn { role: "user" | "assistant"; content: string }
interface Session { history: Turn[]; pending_photos: string[] }

async function loadSession(phone: string, tenantId: number): Promise<Session> {
  const { data } = await admin.from("wa_bot_sessions")
    .select("tenant_id, history, pending_photos").eq("phone", phone).maybeSingle();
  if (!data || data.tenant_id !== tenantId) return { history: [], pending_photos: [] };
  return { history: (data.history ?? []) as Turn[], pending_photos: (data.pending_photos ?? []) as string[] };
}

async function saveSession(phone: string, tenantId: number, history: Turn[], pendingPhotos: string[]) {
  let trimmed = history.slice(-HISTORY_MAX);
  while (trimmed.length && trimmed[0].role !== "user") trimmed = trimmed.slice(1);
  await admin.from("wa_bot_sessions").upsert({
    phone, tenant_id: tenantId, history: trimmed, pending_photos: pendingPhotos,
    updated_at: new Date().toISOString(),
  }, { onConflict: "phone" });
}

// ── Tools del agente (todas scopeadas al tenant) ────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_products",
    description: "Busca productos de la tienda por texto (nombre/descripción/SKU) o categoría. Úsala para encontrar el id antes de editar.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string" },
        category_id: { type: "number" },
        limit: { type: "number", description: "Máximo 50 (default 20)" },
      },
    },
  },
  {
    name: "get_product",
    description: "Detalle completo de un producto por id (precio, stock, tallas, fotos, categorías).",
    input_schema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
  },
  {
    name: "create_product",
    description:
      "Crea un producto. Si hay fotos pendientes del chat y use_pending_photos no es false, se le asignan todas. " +
      "Para tallas con stock usa sizes [{name, stock}] y no mandes stock.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        price: { type: "number", description: "Precio en USD" },
        description: { type: "string" },
        stock: { type: "number", description: "Omitir = stock ilimitado" },
        price_promotional: { type: "number", description: "Precio de oferta (menor al precio)" },
        category_ids: { type: "array", items: { type: "number" } },
        sizes: { type: "array", items: { type: "object", properties: { name: { type: "string" }, stock: { type: "number" } } } },
        use_pending_photos: { type: "boolean" },
        is_hidden: { type: "boolean" },
      },
      required: ["name", "price"],
    },
  },
  {
    name: "update_product",
    description:
      "Edita un producto (solo los campos enviados). add_pending_photos agrega las fotos pendientes del chat; " +
      "replace_photos=true las usa en lugar de las actuales. category_ids reemplaza las categorías.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
        price: { type: "number" },
        description: { type: "string" },
        stock: { type: "number" },
        price_promotional: { type: "number", description: "0 quita la oferta" },
        category_ids: { type: "array", items: { type: "number" } },
        sizes: { type: "array", items: { type: "object", properties: { name: { type: "string" }, stock: { type: "number" } } } },
        is_hidden: { type: "boolean" },
        is_sold_out: { type: "boolean" },
        add_pending_photos: { type: "boolean" },
        replace_photos: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_product",
    description: "Elimina un producto. Irreversible: SOLO con confirmed=true después de que el dueño lo confirmó en el chat.",
    input_schema: {
      type: "object",
      properties: { id: { type: "number" }, confirmed: { type: "boolean" } },
      required: ["id", "confirmed"],
    },
  },
  {
    name: "adjust_prices",
    description:
      "Sube o baja precios en porcentaje (percent=10 sube 10%, -15 baja 15%) para una categoría o una lista de productos. " +
      "Primero llama con confirmed=false para ver cuántos productos afecta, pregunta al dueño, y aplica con confirmed=true.",
    input_schema: {
      type: "object",
      properties: {
        percent: { type: "number" },
        category_id: { type: "number" },
        product_ids: { type: "array", items: { type: "number" } },
        confirmed: { type: "boolean" },
      },
      required: ["percent", "confirmed"],
    },
  },
  {
    name: "list_categories",
    description: "Lista las categorías de la tienda (id, nombre).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_category",
    description: "Crea una categoría nueva.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "list_orders",
    description:
      "Lista órdenes recientes con totales. status: pending | completed | credit | cancelled. days = ventana hacia atrás (default 7).",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string" },
        days: { type: "number" },
        search: { type: "string", description: "Nombre o teléfono del cliente" },
        limit: { type: "number", description: "Máximo 30 (default 10)" },
      },
    },
  },
  {
    name: "get_order",
    description: "Detalle de una orden por su número (#) o id: cliente, productos, pagos, envío.",
    input_schema: {
      type: "object",
      properties: { order_number: { type: "number" }, id: { type: "number" } },
    },
  },
];

interface Ctx {
  link: Link;
  pendingPhotos: string[];
  /** Se vuelve true cuando una tool consumió las fotos pendientes. */
  photosUsed: boolean;
}

const totalStock = (p: { stock: number | null; sizes?: { stock?: number }[]; is_sized?: boolean }) =>
  p.is_sized ? (p.sizes ?? []).reduce((acc, s) => acc + (Number(s.stock) || 0), 0) : p.stock;

async function relinkCategories(productId: number, categoryIds: number[]) {
  await admin.from("product_categories").delete().eq("product_id", productId);
  if (categoryIds.length) {
    await admin.from("product_categories").insert(
      categoryIds.map((cid, i) => ({ product_id: productId, category_id: cid, position: i })),
    );
  }
}

async function ownCategoryIds(tenantId: number, ids: unknown): Promise<number[]> {
  if (!Array.isArray(ids) || !ids.length) return [];
  const { data } = await admin.from("categories").select("id").eq("tenant_id", tenantId).in("id", ids.map(Number));
  return (data ?? []).map((c) => c.id);
}

// deno-lint-ignore no-explicit-any
function productFields(a: Record<string, any>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (a.name !== undefined) p.name = String(a.name).trim();
  if (a.description !== undefined) p.description = a.description;
  if (a.price !== undefined) p.price = Number(a.price) || 0;
  if (a.price_promotional !== undefined) p.price_promotional = Number(a.price_promotional) > 0 ? Number(a.price_promotional) : null;
  if (a.stock !== undefined) p.stock = a.stock === null ? null : Number(a.stock);
  if (a.is_hidden !== undefined) p.is_hidden = !!a.is_hidden;
  if (a.is_sold_out !== undefined) p.is_sold_out = !!a.is_sold_out;
  if (Array.isArray(a.sizes)) {
    // deno-lint-ignore no-explicit-any
    p.sizes = a.sizes.map((s: any) => ({ name: String(s.name ?? ""), stock: s.stock === undefined ? null : Number(s.stock) }));
    p.is_sized = a.sizes.length > 0;
    if (a.sizes.length) p.stock = null;
  }
  return p;
}

// deno-lint-ignore no-explicit-any
async function runTool(name: string, a: Record<string, any>, ctx: Ctx): Promise<unknown> {
  const tenantId = ctx.link.tenant_id;
  switch (name) {
    case "list_products": {
      const limit = Math.min(Number(a.limit) || 20, 50);
      let q = admin.from("products")
        .select("id, name, price, price_promotional, stock, is_sized, sizes, is_hidden, is_sold_out, product_categories(category_id)")
        .eq("tenant_id", tenantId).order("position", { ascending: true }).limit(a.category_id ? 500 : limit);
      if (a.search?.trim()) q = q.ilike("search_blob", `%${a.search.trim()}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      let rows = data ?? [];
      if (a.category_id) {
        rows = rows.filter((r) => (r.product_categories ?? []).some((pc) => pc.category_id === Number(a.category_id))).slice(0, limit);
      }
      return {
        count: rows.length,
        products: rows.map((r) => ({
          id: r.id, name: r.name, price: r.price, price_promotional: r.price_promotional,
          stock: totalStock(r), hidden: r.is_hidden, sold_out: r.is_sold_out,
        })),
      };
    }
    case "get_product": {
      const { data } = await admin.from("products")
        .select("id, name, description, price, price_promotional, stock, is_sized, sizes, is_variant, variants, photos, is_hidden, is_sold_out, sku, product_categories(categories(id, name))")
        .eq("tenant_id", tenantId).eq("id", Number(a.id)).maybeSingle();
      if (!data) return { error: "Producto no encontrado en esta tienda" };
      return { ...data, total_stock: totalStock(data) };
    }
    case "create_product": {
      if (!String(a.name ?? "").trim()) return { error: "Falta el nombre" };
      const { data: maxRow } = await admin.from("products").select("position").eq("tenant_id", tenantId)
        .order("position", { ascending: false }).limit(1).maybeSingle();
      const photos = a.use_pending_photos === false ? [] : ctx.pendingPhotos;
      const payload = {
        ...productFields(a),
        price: Number(a.price) || 0,
        photos,
        tenant_id: tenantId,
        auth_user_id: ctx.link.auth_user_id,
        position: (Number(maxRow?.position) || 0) + 1,
      };
      const { data, error } = await admin.from("products").insert(payload).select("id, name, price, stock, photos").single();
      if (error) return { error: error.message };
      if (photos.length) ctx.photosUsed = true;
      const cats = await ownCategoryIds(tenantId, a.category_ids);
      if (cats.length) await relinkCategories(data.id, cats);
      return { created: true, product: { ...data, photos: data.photos?.length ?? 0 } };
    }
    case "update_product": {
      const { data: current } = await admin.from("products").select("id, photos")
        .eq("tenant_id", tenantId).eq("id", Number(a.id)).maybeSingle();
      if (!current) return { error: "Producto no encontrado en esta tienda" };
      const payload = productFields(a);
      if ((a.add_pending_photos || a.replace_photos) && ctx.pendingPhotos.length) {
        payload.photos = a.replace_photos ? ctx.pendingPhotos : [...(current.photos ?? []), ...ctx.pendingPhotos];
        ctx.photosUsed = true;
      }
      if (Object.keys(payload).length) {
        const { error } = await admin.from("products").update(payload).eq("id", current.id).eq("tenant_id", tenantId);
        if (error) return { error: error.message };
      }
      if (Array.isArray(a.category_ids)) await relinkCategories(current.id, await ownCategoryIds(tenantId, a.category_ids));
      return { updated: true, id: current.id, changed: Object.keys(payload) };
    }
    case "delete_product": {
      if (a.confirmed !== true) return { error: "Pide confirmación al dueño antes de eliminar." };
      const { error, count } = await admin.from("products").delete({ count: "exact" })
        .eq("tenant_id", tenantId).eq("id", Number(a.id));
      if (error) return { error: error.message };
      return { deleted: count ?? 0 };
    }
    case "adjust_prices": {
      const percent = Number(a.percent);
      if (!percent || Math.abs(percent) > 90) return { error: "Porcentaje inválido" };
      let ids: number[] = [];
      if (Array.isArray(a.product_ids) && a.product_ids.length) {
        ids = a.product_ids.map(Number);
      } else if (a.category_id) {
        const { data } = await admin.from("product_categories").select("product_id").eq("category_id", Number(a.category_id));
        ids = (data ?? []).map((r) => r.product_id);
      } else {
        return { error: "Indica una categoría o productos" };
      }
      const { data: rows } = await admin.from("products").select("id, name, price, price_promotional")
        .eq("tenant_id", tenantId).in("id", ids.length ? ids : [0]);
      const list = rows ?? [];
      const factor = 1 + percent / 100;
      const round = (n: number) => Math.round(n * factor * 100) / 100;
      if (a.confirmed !== true) {
        return {
          preview: true, affected: list.length,
          sample: list.slice(0, 5).map((r) => ({ name: r.name, from: r.price, to: round(Number(r.price)) })),
        };
      }
      for (const r of list) {
        await admin.from("products").update({
          price: round(Number(r.price)),
          ...(r.price_promotional ? { price_promotional: round(Number(r.price_promotional)) } : {}),
        }).eq("id", r.id).eq("tenant_id", tenantId);
      }
      return { updated: list.length };
    }
    case "list_categories": {
      const { data } = await admin.from("categories").select("id, name").eq("tenant_id", tenantId)
        .eq("is_view_all", false).order("position", { ascending: true });
      return { categories: data ?? [] };
    }
    case "create_category": {
      const name = String(a.name ?? "").trim();
      if (!name) return { error: "Falta el nombre" };
      const { data: maxRow } = await admin.from("categories").select("position").eq("tenant_id", tenantId)
        .order("position", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      const { data, error } = await admin.from("categories").insert({
        name, tenant_id: tenantId, auth_user_id: ctx.link.auth_user_id, position: (Number(maxRow?.position) || 0) + 1,
      }).select("id, name").single();
      if (error) return { error: error.message };
      return { created: true, category: data };
    }
    case "list_orders": {
      const days = Math.min(Number(a.days) || 7, 365);
      const limit = Math.min(Number(a.limit) || 10, 30);
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      let q = admin.from("orders")
        .select("id, order_number, name, phone, status, total_usd, payment_method, source, created_at", { count: "exact" })
        .eq("tenant_id", tenantId).gte("created_at", since).order("created_at", { ascending: false });
      if (a.status) q = q.eq("status", String(a.status));
      if (a.search?.trim()) q = q.or(`name.ilike.%${a.search.trim()}%,phone.ilike.%${digits(a.search)}%`);
      const { data, error, count } = await q.limit(200);
      if (error) return { error: error.message };
      const rows = data ?? [];
      const total = rows.reduce((acc, r) => acc + (Number(r.total_usd) || 0), 0);
      return { days, total_orders: count ?? rows.length, total_usd: Math.round(total * 100) / 100, orders: rows.slice(0, limit) };
    }
    case "get_order": {
      let q = admin.from("orders")
        .select("id, order_number, name, phone, email, status, products, total_usd, total_bs, payment_method, payments, shipping_method, shipping_address, shipping_fee, discount_amount, comments, created_at")
        .eq("tenant_id", tenantId);
      if (a.order_number) q = q.eq("order_number", Number(a.order_number));
      else if (a.id) q = q.eq("id", Number(a.id));
      else return { error: "Indica el número de orden" };
      const { data } = await q.maybeSingle();
      if (!data) return { error: "Orden no encontrada" };
      return data;
    }
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

// ── Agente ──────────────────────────────────────────────────────────────────
const SYSTEM = `Eres el asistente de WhatsApp de CatalogoHoy. Hablas con el DUEÑO de una tienda (no con sus clientes) y le ayudas a gestionar su catálogo: crear y editar productos, subir fotos, ajustar precios, crear categorías y consultar sus órdenes, usando las herramientas.

Cómo responder:
- Español, trato de "tú", cercano y muy breve: es WhatsApp. Máximo 5-6 líneas salvo que pidan una lista.
- Formato de WhatsApp: *negritas* con un asterisco, sin tablas ni encabezados markdown.
- Precios en USD con el símbolo $ (ej. $25).
- Al terminar una acción, confirma qué hiciste en una o dos líneas.

Reglas:
- Si te dan nombre y precio, crea el producto directo, sin pedir confirmación. Si falta el precio, pregúntalo. Si hay fotos pendientes, úsalas en el producto que crees o edites.
- Si ves la foto y no te dieron descripción, escribe una descripción corta y vendedora basada en la foto.
- Para editar, busca primero el producto con list_products. Si hay varios parecidos, pregunta cuál.
- Eliminar productos y cambiar precios en lote: pide confirmación explícita antes de aplicarlo.
- Las órdenes son solo de consulta: si piden cambiar el estado de una orden, explica que por ahora eso se hace desde el panel.
- No inventes datos (precios, stock, órdenes): usa siempre las herramientas.
- Si te piden algo fuera de la gestión de la tienda, responde amable que solo ayudas con el catálogo y las órdenes, y que para soporte escriban a https://wa.me/584220240947.`;

interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number; tools: number }

async function runAgent(
  link: Link,
  session: Session,
  userText: string,
  shopName: string,
  shopUrl: string,
): Promise<{ reply: string; actions: string[]; usage: Usage; photosUsed: boolean }> {
  const ctx: Ctx = { link, pendingPhotos: session.pending_photos, photosUsed: false };
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, tools: 0 };
  const actions: string[] = [];

  const today = new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas", dateStyle: "full" });
  const context =
    `[Tienda: ${shopName}${shopUrl ? ` · ${shopUrl}` : ""} · Hoy: ${today}` +
    (ctx.pendingPhotos.length ? ` · Fotos pendientes en el chat: ${ctx.pendingPhotos.length}` : "") + "]";
  const userContent: Anthropic.Beta.BetaContentBlockParam[] = [
    ...ctx.pendingPhotos.slice(-4).map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
    { type: "text", text: `${context}\n${userText}` },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...session.history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userContent },
  ];

  let reply = "";
  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const res = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      // Si el modelo declina, el servidor reintenta con el modelo de respaldo.
      fallbacks: "default",
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    usage.input += res.usage.input_tokens ?? 0;
    usage.output += res.usage.output_tokens ?? 0;
    usage.cacheRead += res.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += res.usage.cache_creation_input_tokens ?? 0;
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "refusal") {
      reply = "Uy, eso no lo puedo hacer. ¿Te ayudo con algo de tu catálogo?";
      break;
    }
    const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !toolUses.length) {
      reply = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.Beta.BetaTextBlock).text).join("\n").trim();
      break;
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      usage.tools++;
      let out: unknown;
      try {
        out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, ctx);
      } catch (e) {
        out = { error: e instanceof Error ? e.message : String(e) };
      }
      const isError = !!(out && typeof out === "object" && "error" in out);
      if (!isError && !tu.name.startsWith("list_") && !tu.name.startsWith("get_")) {
        actions.push(`${tu.name} ${JSON.stringify(out).slice(0, 160)}`);
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 12000), is_error: isError });
    }
    messages.push({ role: "user", content: results });
  }

  return { reply: reply || "Listo 👍", actions, usage, photosUsed: ctx.photosUsed };
}

// ── Mensaje entrante ────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
function messageText(m: any): string {
  return (
    m.text?.body ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    m.button?.text ??
    m.image?.caption ??
    ""
  ).trim();
}

// deno-lint-ignore no-explicit-any
async function handleInbound(m: any) {
  const phone = digits(m.from ?? "");
  if (!phone) return;
  let text = messageText(m);
  const code = text.match(/\b(\d{6})\b/)?.[1];
  const link = await getLink(phone);

  // Vinculación (o cambio de tienda) con el código del panel.
  if (code && (!link || /vincular/i.test(text))) {
    if (!(await linkWithCode(phone, code))) {
      await sendText(phone, "Ese código no es válido o ya venció. Genera uno nuevo en tu panel (Inicio → Gestiona tu tienda por WhatsApp).");
    }
    return;
  }
  if (!link) {
    await sendText(phone, "Para usar el asistente, conecta tu WhatsApp desde tu panel de CatalogoHoy: Inicio → *Gestiona tu tienda por WhatsApp*.");
    return;
  }
  if (!tenantAllowed(link.tenant_id)) {
    await sendText(phone, "El asistente por WhatsApp todavía no está disponible para tu tienda. ¡Muy pronto! 🙌");
    return;
  }

  await markReadTyping(m.id);
  admin.from("wa_bot_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id).then(() => {});

  // Fotos: se acumulan. Si vienen sin texto, esperamos un momento por si
  // llegan más y respondemos UNA sola vez.
  if (m.type === "image" && m.image?.id) {
    const url = await storeMedia(m.image.id, m.image.mime_type ?? "", "multimedia/wa_");
    if (!url) {
      await sendText(phone, "No pude descargar la foto 😕 ¿Me la reenvías?");
      return;
    }
    await admin.rpc("wa_bot_push_photo", { p_phone: phone, p_tenant_id: link.tenant_id, p_url: url });
    if (!text) {
      await new Promise((r) => setTimeout(r, PHOTO_ACK_DELAY_MS));
      const { data: s } = await admin.from("wa_bot_sessions").select("pending_photos").eq("phone", phone).maybeSingle();
      const list = (s?.pending_photos ?? []) as string[];
      if (list[list.length - 1] !== url) return; // llegó otra foto después: responde esa
      await sendText(
        phone,
        `📸 Tengo ${list.length === 1 ? "la foto" : `${list.length} fotos`}. ¿Qué hago?\n` +
          "Ej: *Crea Zapato rojo, $25, stock 10* o *agrégalas al producto Zapato rojo*.",
      );
      return;
    }
  } else if (m.type === "audio" && m.audio?.id) {
    const url = await storeMedia(m.audio.id, m.audio.mime_type ?? "", `chat-media/${link.tenant_id}/bot-`);
    text = url ? await transcribe(url) : "";
    if (!text) {
      await sendText(phone, "No pude entender el audio 😕 ¿Me lo escribes?");
      return;
    }
  } else if (!text) {
    await sendText(phone, "Por ahora entiendo texto, fotos y notas de voz 🙂");
    return;
  }

  // Créditos de IA (1 por mensaje procesado), del pozo del dueño vinculado.
  await admin.rpc("ensure_ai_credits", { p_user_id: link.user_id });
  const { data: balance } = await admin.rpc("spend_ai_credits", { p_user_id: link.user_id, p_cost: CREDIT_COST });
  if (balance === -1) {
    await sendText(phone, "Te quedaste sin créditos de IA este mes 😕 Puedes comprar más o subir de plan desde tu panel.");
    return;
  }

  const session = await loadSession(phone, link.tenant_id);
  const shop = await tenantInfo(link.tenant_id);
  try {
    const { reply, actions, usage, photosUsed } = await runAgent(link, session, text, shop.name, shop.url);
    await sendText(phone, reply);

    const userNote = session.pending_photos.length ? `${text}\n[Envió ${session.pending_photos.length} foto(s)]` : text;
    const assistantNote = actions.length ? `${reply}\n[Acciones: ${actions.join(" | ")}]` : reply;
    // Las fotos que no se usaron siguen pendientes (se re-lee por si llegaron más).
    let pendingAfter: string[] = [];
    if (!photosUsed) {
      const { data: s } = await admin.from("wa_bot_sessions").select("pending_photos").eq("phone", phone).maybeSingle();
      pendingAfter = (s?.pending_photos ?? []) as string[];
    }
    await saveSession(phone, link.tenant_id, [
      ...session.history,
      { role: "user", content: userNote },
      { role: "assistant", content: assistantNote },
    ], pendingAfter);

    await admin.from("wa_bot_usage").insert({
      tenant_id: link.tenant_id, phone, model: MODEL,
      input_tokens: usage.input, output_tokens: usage.output,
      cache_read_tokens: usage.cacheRead, cache_write_tokens: usage.cacheWrite,
      tool_calls: usage.tools, credits: CREDIT_COST,
    });
  } catch (e) {
    console.error("[wa-store-bot] agent", e instanceof Error ? e.message : String(e));
    await admin.rpc("refund_ai_credits", { p_user_id: link.user_id, p_cost: CREDIT_COST });
    await sendText(phone, "Tuve un problema procesando tu mensaje 😕 Intenta de nuevo en un momento.");
  }
}

// ── Acciones del panel ──────────────────────────────────────────────────────
async function handlePanel(req: Request): Promise<Response> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return json({ error: "Unauthorized" }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const tenantId = Number(body.tenantId);
  if (!tenantId) return json({ error: "Falta tenantId" }, 400);

  const { data: user } = await admin.from("users").select("id").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!user) return json({ error: "Usuario no encontrado" }, 403);
  const { data: membership } = await admin.from("users_tenants").select("role")
    .eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return json({ error: "Solo el dueño de la tienda puede conectar WhatsApp" }, 403);
  }
  if (!tenantAllowed(tenantId)) return json({ error: "No disponible para esta tienda" }, 403);

  const phone = await botPhone();
  switch (body.action) {
    case "status": {
      const { data: links } = await admin.from("wa_bot_links")
        .select("id, phone, created_at, last_used_at").eq("tenant_id", tenantId).order("created_at");
      return json({ botPhone: phone, links: links ?? [] });
    }
    case "create_code": {
      for (let i = 0; i < 5; i++) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const { error } = await admin.from("wa_bot_link_codes").insert({
          code, tenant_id: tenantId, user_id: user.id, auth_user_id: auth.user.id,
          expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
        });
        if (!error) {
          const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(`Vincular ${code}`)}`;
          return json({ code, botPhone: phone, waLink, expiresInMinutes: CODE_TTL_MIN });
        }
      }
      return json({ error: "No se pudo generar el código" }, 500);
    }
    case "unlink": {
      await admin.from("wa_bot_links").delete().eq("id", Number(body.linkId)).eq("tenant_id", tenantId);
      return json({ ok: true });
    }
    default:
      return json({ error: "Acción desconocida" }, 400);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  if (req.headers.get("x-internal-secret")) {
    if (req.headers.get("x-internal-secret") !== SERVICE_ROLE_KEY) return json({ error: "Forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const task = handleInbound(body?.message ?? {}).catch((e) =>
      console.error("[wa-store-bot] inbound", e instanceof Error ? e.message : String(e))
    );
    EdgeRuntime.waitUntil(task);
    return json({ accepted: true }, 202);
  }
  return await handlePanel(req);
});

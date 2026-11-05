import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { uploadToS3 } from "../_shared/s3.ts";
import { type Ctx, type Link, runTool, TOOLS } from "../_shared/catalog-tools.ts";
import { DOCS_MD } from "./docs.ts";

// =============================================================================
// public-api — API pública de CatalogoHoy (2026-11-05).
//
// Software externo (p. ej. agentes de IA de "Work by Agents") gestiona UNA
// tienda con un token que crea el dueño en Perfil → API (tabla api_tokens,
// migración 20261105_public_api_tokens.sql). Docs públicas: docs.ts (GET /docs).
//
// Rutas (después de /functions/v1/public-api):
//   GET  /docs                  → documentación (markdown, sin token)
//   GET  /v1/me                 → tienda y scopes del token
//   GET  /v1/tools              → herramientas permitidas (JSON Schema)
//   POST /v1/tools/{name}       → ejecuta una herramienta (body = argumentos)
//   GET  /v1/products[/{id}] · /v1/orders[/{id}] · /v1/categories · /v1/customers · /v1/store
//   POST /mcp                   → servidor MCP (JSON-RPC 2.0, Streamable HTTP sin SSE)
//
// Seguridad:
//   * Authorization: Bearer cht_… (o X-API-Key). Se busca por hash SHA-256.
//   * El tenant sale SIEMPRE del token: ninguna ruta acepta tenant_id.
//   * Cada herramienta exige su scope (TOOL_SCOPES). Las desconocidas no existen.
//   * El token deja de servir si se revoca, vence, o quien lo creó deja de ser
//     owner/admin de la tienda.
//   * Límite: RATE_LIMIT llamadas por minuto por token. Todo queda en api_request_log.
//   * Las URLs de fotos/archivos externas se descargan y se suben a nuestro CDN.
// Deploy con verify_jwt=false (auth propia).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const RATE_LIMIT = Number(Deno.env.get("PUBLIC_API_RATE_LIMIT") ?? 120); // llamadas por minuto por token
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_CALL = 20;
const CDN_PREFIX = "https://cdn.catalogohoy.com/";
const API_VERSION = "1.0.0";
const MCP_PROTOCOL = "2025-06-18";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, mcp-protocol-version, mcp-session-id",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors, ...extra } });
const apiError = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

// ── Herramientas y scopes ───────────────────────────────────────────────────
const TOOL_SCOPES: Record<string, string> = {
  list_products: "products:read",
  get_product: "products:read",
  list_categories: "products:read",
  create_product: "products:write",
  update_product: "products:write",
  bulk_edit_products: "products:write",
  delete_product: "products:write",
  adjust_prices: "products:write",
  create_category: "products:write",
  list_orders: "orders:read",
  get_order: "orders:read",
  list_order_statuses: "orders:read",
  get_metrics: "orders:read",
  create_order: "orders:write",
  update_order: "orders:write",
  set_order_status: "orders:write",
  manage_order_status: "orders:write",
  delete_order: "orders:write",
  list_customers: "customers:read",
  get_store_settings: "settings:read",
  get_exchange_rate: "settings:read",
  update_store_settings: "settings:write",
  set_business_hours: "settings:write",
  set_whatsapp_sellers: "settings:write",
  set_order_notifications: "settings:write",
  manage_payment_method: "settings:write",
  manage_shipping_method: "settings:write",
  set_exchange_rate: "settings:write",
  list_expenses: "expenses:read",
  create_expense: "expenses:write",
  update_expense: "expenses:write",
  delete_expense: "expenses:write",
};

const PHOTO_URLS = {
  type: "array",
  items: { type: "string" },
  description: "URLs públicas (https) de imágenes JPG/PNG/WEBP, máx. 10 MB c/u. Se copian al CDN de CatalogoHoy.",
};

/** Las tools del bot hablan de "fotos pendientes del chat"; aquí se mandan URLs. */
const DESCRIPTION_OVERRIDES: Record<string, string> = {
  create_product:
    "Crea un producto. Fotos: photo_urls (la primera es la principal). Para tallas con stock usa sizes [{name, stock}] y no " +
    "mandes stock. Si las opciones tienen precios distintos usa variants (no sizes); cada variante puede traer sus photo_urls.",
  update_product:
    "Edita un producto (solo los campos enviados). photo_urls agrega fotos; con replace_photos=true reemplazan las actuales. " +
    "category_ids reemplaza las categorías. variants reemplaza las variantes (cada una con su precio y sus photo_urls).",
  update_store_settings:
    "Cambia ajustes generales de la tienda. Manda solo los campos a cambiar. logo_url / banner_url: URL de la imagen nueva. " +
    "description es texto (se guarda como párrafos). theme_color en hex (#0f402c). whatsapp_order_message admite {nombre} " +
    "{telefono} {productos} {total} {totalBs} {envio} {direccion} {comentarios} {metodoPago} (máx. 1000). social_links: solo " +
    "las redes a cambiar; url vacía la oculta. product_currency / display_currency: código ISO (USD, VES, COP, EUR…).",
  create_expense:
    "Registra un gasto o factura de proveedor. attachment_urls: URLs (https) de la foto o PDF de la factura (máx. 10). " +
    "Categorías: mercancia, servicios, transporte, alquiler, sueldos, impuestos, publicidad, otros. Moneda ISO (USD, VES, " +
    "EUR, COP…), default la de la tienda.",
  update_expense:
    "Edita un gasto (por su id de list_expenses): manda solo los campos a cambiar. Para marcar como pagada: status paid " +
    "(paid_at = hoy si no se indica). Para un pago parcial usa add_payment (o paid_amount con el total abonado); si con eso " +
    "se completa el monto, queda pagada. attachment_urls agrega archivos.",
};

// deno-lint-ignore no-explicit-any
type Schema = Record<string, any>;
interface ApiTool { name: string; description: string; inputSchema: Schema; scope: string }

const API_TOOLS: ApiTool[] = TOOLS.filter((t) => TOOL_SCOPES[t.name]).map((t) => {
  const schema: Schema = structuredClone(t.input_schema);
  const props: Schema = schema.properties ?? {};
  for (const k of ["photo_numbers", "use_pending_photos", "add_pending_photos", "attach_pending_photos",
    "logo_from_photo", "banner_from_photo", "logo_photo_number", "banner_photo_number"]) delete props[k];
  if (t.name === "create_product" || t.name === "update_product") {
    props.photo_urls = PHOTO_URLS;
    const vItems = props.variants?.items?.properties;
    if (vItems) {
      delete vItems.photo_numbers;
      vItems.photo_urls = PHOTO_URLS;
    }
  }
  if (t.name === "update_store_settings") {
    props.logo_url = { type: "string", description: "URL (https) de la imagen del logo" };
    props.banner_url = { type: "string", description: "URL (https) de la imagen del banner" };
  }
  if (t.name === "create_expense" || t.name === "update_expense") {
    props.attachment_urls = { type: "array", items: { type: "string" }, description: "URLs (https) de imágenes o PDFs (máx. 10)" };
  }
  schema.properties = props;
  if (Array.isArray(schema.required)) schema.required = schema.required.filter((r: string) => r in props);
  return {
    name: t.name,
    description: DESCRIPTION_OVERRIDES[t.name] ?? t.description ?? "",
    inputSchema: schema,
    scope: TOOL_SCOPES[t.name],
  };
});
const TOOL_BY_NAME = new Map(API_TOOLS.map((t) => [t.name, t]));

// ── Auth ────────────────────────────────────────────────────────────────────
interface TokenRow {
  id: string;
  tenant_id: number;
  created_by: number;
  name: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}
interface Auth { token: TokenRow; authUserId: string; shopUrl: string; storeName: string }

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(\S+)$/i.exec(h)?.[1];
  const raw = (bearer ?? req.headers.get("x-api-key") ?? "").trim();
  return /^cht_[0-9a-f]{48}$/.test(raw) ? raw : null;
}

async function authenticate(req: Request): Promise<Auth | Response> {
  const raw = readToken(req);
  if (!raw) return apiError(401, "unauthorized", "Falta el token. Usa el header Authorization: Bearer cht_…");
  const { data: token } = await admin.from("api_tokens")
    .select("id, tenant_id, created_by, name, scopes, expires_at, revoked_at, last_used_at")
    .eq("token_hash", await sha256Hex(raw)).maybeSingle<TokenRow>();
  if (!token || token.revoked_at) return apiError(401, "invalid_token", "Token inválido o revocado.");
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    return apiError(401, "token_expired", "El token venció. Crea uno nuevo en Perfil → API.");
  }
  // Quien creó el token tiene que seguir siendo owner/admin de la tienda.
  const [{ data: ut }, { data: user }, { data: tenant }] = await Promise.all([
    admin.from("users_tenants").select("role").eq("user_id", token.created_by).eq("tenant_id", token.tenant_id).maybeSingle(),
    admin.from("users").select("auth_user_id").eq("id", token.created_by).maybeSingle(),
    admin.from("tenants").select("name, slug, custom_domain").eq("id", token.tenant_id).maybeSingle(),
  ]);
  if (!ut || !["owner", "admin"].includes(ut.role) || !user?.auth_user_id || !tenant) {
    return apiError(401, "invalid_token", "El token ya no es válido para esta tienda.");
  }
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("api_request_log").select("id", { count: "exact", head: true })
    .eq("token_id", token.id).gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT) {
    return json({ error: { code: "rate_limited", message: `Máximo ${RATE_LIMIT} llamadas por minuto.` } }, 429, { "Retry-After": "60" });
  }
  if (!token.last_used_at || Date.now() - new Date(token.last_used_at).getTime() > 60_000) {
    await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id);
  }
  const domain = tenant.custom_domain?.trim() || (tenant.slug ? `${tenant.slug}.catalogohoy.com` : "");
  return { token, authUserId: user.auth_user_id, shopUrl: domain ? `https://${domain}` : "", storeName: tenant.name ?? "" };
}

async function logCall(auth: Auth, req: Request, tool: string | null, status: number, error: string | null, started: number) {
  await admin.from("api_request_log").insert({
    token_id: auth.token.id,
    tenant_id: auth.token.tenant_id,
    method: req.method,
    tool,
    status,
    error: error?.slice(0, 500) ?? null,
    duration_ms: Date.now() - started,
    ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
  });
}

// ── Archivos por URL → CDN ──────────────────────────────────────────────────
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const FILE_TYPES = [...IMAGE_TYPES, "application/pdf"];

async function importUrl(url: unknown, tenantId: number, allowed: string[]): Promise<string> {
  const u = String(url ?? "").trim();
  if (u.startsWith(CDN_PREFIX)) return u;
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error(`URL inválida: ${u.slice(0, 120)}`);
  }
  if (parsed.protocol !== "https:") throw new Error(`Solo se aceptan URLs https: ${u.slice(0, 120)}`);
  const res = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`No pude descargar ${u.slice(0, 120)} (HTTP ${res.status})`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!allowed.includes(type)) throw new Error(`Tipo de archivo no permitido (${type || "desconocido"}): ${u.slice(0, 120)}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES) throw new Error(`El archivo pasa de 10 MB: ${u.slice(0, 120)}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`El archivo pasa de 10 MB: ${u.slice(0, 120)}`);
  const ext = type === "application/pdf" ? "pdf" : type.split("/")[1].replace("jpeg", "jpg");
  const key = `api/${tenantId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return await uploadToS3(key, bytes, type);
}

/**
 * Traduce los argumentos de la API (URLs) al formato de las tools del bot
 * (fotos pendientes numeradas). Devuelve los argumentos y las fotos pendientes.
 */
// deno-lint-ignore no-explicit-any
async function prepareArgs(name: string, input: Record<string, any>, tenantId: number): Promise<{ args: Record<string, any>; pending: string[] }> {
  const a = structuredClone(input ?? {});
  for (const k of ["photo_numbers", "use_pending_photos", "add_pending_photos", "attach_pending_photos",
    "logo_from_photo", "banner_from_photo", "logo_photo_number", "banner_photo_number"]) delete a[k];
  const pending: string[] = [];
  const countUrls = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  const total = countUrls(a.photo_urls) + countUrls(a.attachment_urls) + (a.logo_url ? 1 : 0) + (a.banner_url ? 1 : 0) +
    (Array.isArray(a.variants) ? a.variants.reduce((n: number, v: { photo_urls?: unknown }) => n + countUrls(v?.photo_urls), 0) : 0);
  if (total > MAX_FILES_PER_CALL) throw new Error(`Máximo ${MAX_FILES_PER_CALL} archivos por llamada.`);

  const addPhotos = async (urls: unknown): Promise<number[]> => {
    const nums: number[] = [];
    for (const u of Array.isArray(urls) ? urls : []) {
      pending.push(await importUrl(u, tenantId, IMAGE_TYPES));
      nums.push(pending.length);
    }
    return nums;
  };

  if (name === "create_product" || name === "update_product") {
    const nums = await addPhotos(a.photo_urls);
    delete a.photo_urls;
    if (Array.isArray(a.variants)) {
      for (const v of a.variants) {
        if (v && typeof v === "object") {
          const vn = await addPhotos(v.photo_urls);
          delete v.photo_urls;
          if (vn.length) v.photo_numbers = vn;
        }
      }
    }
    if (name === "create_product") {
      if (nums.length) a.photo_numbers = nums;
      else if (!pending.length) a.use_pending_photos = false;
    } else if (nums.length) {
      a.photo_numbers = nums;
      a.add_pending_photos = true;
    }
  } else if (name === "update_store_settings") {
    if (a.logo_url) a.logo_photo_number = (await addPhotos([a.logo_url]))[0];
    if (a.banner_url) a.banner_photo_number = (await addPhotos([a.banner_url]))[0];
    delete a.logo_url;
    delete a.banner_url;
  } else if (name === "create_expense" || name === "update_expense") {
    if (Array.isArray(a.attachment_urls)) {
      const out: string[] = [];
      for (const u of a.attachment_urls.slice(0, 10)) out.push(await importUrl(u, tenantId, FILE_TYPES));
      a.attachment_urls = out;
    }
  }
  return { args: a, pending };
}

// ── Ejecutar una herramienta ────────────────────────────────────────────────
type CallResult = { ok: true; result: unknown } | { ok: false; status: number; code: string; message: string };

// deno-lint-ignore no-explicit-any
async function callTool(auth: Auth, name: string, input: Record<string, any>): Promise<CallResult> {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) return { ok: false, status: 404, code: "unknown_tool", message: `No existe la herramienta ${name}.` };
  if (!auth.token.scopes.includes(tool.scope)) {
    return { ok: false, status: 403, code: "missing_scope", message: `El token no tiene el permiso ${tool.scope}.` };
  }
  if (input !== undefined && (typeof input !== "object" || input === null || Array.isArray(input))) {
    return { ok: false, status: 400, code: "invalid_arguments", message: "Los argumentos deben ser un objeto JSON." };
  }
  let prepared;
  try {
    prepared = await prepareArgs(name, input ?? {}, auth.token.tenant_id);
  } catch (e) {
    return { ok: false, status: 400, code: "invalid_file", message: e instanceof Error ? e.message : String(e) };
  }
  const link: Link = {
    id: 0,
    tenant_id: auth.token.tenant_id,
    user_id: auth.token.created_by,
    auth_user_id: auth.authUserId,
    phone: "",
  };
  const ctx: Ctx = { link, shopUrl: auth.shopUrl, pendingPhotos: prepared.pending, usedPhotos: new Set(), sentMedia: [] };
  try {
    const out = await runTool(name, prepared.args, ctx);
    if (out && typeof out === "object" && "error" in out && Object.keys(out).length === 1) {
      return { ok: false, status: 422, code: "tool_error", message: String((out as { error: unknown }).error) };
    }
    return { ok: true, result: out };
  } catch (e) {
    console.error("[public-api] tool", name, e instanceof Error ? e.message : String(e));
    return { ok: false, status: 500, code: "internal_error", message: "Error interno ejecutando la herramienta." };
  }
}

const allowedTools = (auth: Auth) => API_TOOLS.filter((t) => auth.token.scopes.includes(t.scope));

// ── MCP (JSON-RPC 2.0) ──────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

async function handleRpc(auth: Auth, req: Request, msg: Rpc, started: number): Promise<unknown | null> {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  const isNotification = msg.id === undefined || msg.id === null;
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : MCP_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "catalogohoy", title: "CatalogoHoy", version: API_VERSION },
        instructions:
          `Gestionas la tienda "${auth.storeName}" en CatalogoHoy (${auth.shopUrl}). Precios en USD salvo que se indique. ` +
          "Usa list_* para buscar ids antes de editar. Pide confirmación al usuario antes de borrar.",
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: allowedTools(auth).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const res = await callTool(auth, name, msg.params?.arguments ?? {});
      await logCall(auth, req, name, res.ok ? 200 : res.status, res.ok ? null : res.message, started);
      if (!res.ok && (res.code === "unknown_tool")) return fail(-32602, res.message);
      return reply({
        content: [{ type: "text", text: JSON.stringify(res.ok ? res.result : { error: res.message }) }],
        ...(res.ok && res.result && typeof res.result === "object" && !Array.isArray(res.result)
          ? { structuredContent: res.result }
          : {}),
        isError: !res.ok,
      });
    }
    default:
      if (isNotification) return null; // notifications/initialized, etc.
      return fail(-32601, `Método no soportado: ${msg.method}`);
  }
}

async function handleMcp(auth: Auth, req: Request, started: number): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }, 400);
  }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Rpc[];
  const out: unknown[] = [];
  for (const m of msgs) {
    const r = await handleRpc(auth, req, m, started);
    if (r !== null) out.push(r);
  }
  if (!out.length) return new Response(null, { status: 202, headers: cors });
  return json(batch ? out : out[0], 200, { "MCP-Protocol-Version": MCP_PROTOCOL });
}

// ── REST ────────────────────────────────────────────────────────────────────
function queryArgs(url: URL): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams) {
    if (v === "true" || v === "false") out[k] = v === "true";
    else if (v !== "" && !Number.isNaN(Number(v)) && !/^0\d/.test(v) && k !== "search" && k !== "phone") out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

const REST_ROUTES: { re: RegExp; tool: string; idKey?: string; numeric?: boolean }[] = [
  { re: /^\/v1\/products\/?$/, tool: "list_products" },
  { re: /^\/v1\/products\/(\d+)$/, tool: "get_product", idKey: "id", numeric: true },
  { re: /^\/v1\/orders\/?$/, tool: "list_orders" },
  { re: /^\/v1\/orders\/([\w-]+)$/, tool: "get_order", idKey: "order_number", numeric: true },
  { re: /^\/v1\/categories\/?$/, tool: "list_categories" },
  { re: /^\/v1\/customers\/?$/, tool: "list_customers" },
  { re: /^\/v1\/store\/?$/, tool: "get_store_settings" },
];

function routePath(url: URL): string {
  const p = url.pathname;
  const i = p.indexOf("/public-api");
  const rest = i >= 0 ? p.slice(i + "/public-api".length) : p;
  return rest.replace(/\/+$/, "") || "/";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const started = Date.now();
  const url = new URL(req.url);
  const path = routePath(url);

  if (path === "/" || path === "/v1") {
    return json({
      name: "CatalogoHoy API",
      version: API_VERSION,
      docs: "https://help.catalogohoy.com/api",
      endpoints: ["GET /v1/me", "GET /v1/tools", "POST /v1/tools/{name}", "POST /mcp"],
    });
  }
  if (path === "/docs") {
    return new Response(DOCS_MD, { headers: { "Content-Type": "text/markdown; charset=utf-8", ...cors } });
  }
  if (path === "/mcp" && req.method === "GET") {
    return new Response(null, { status: 405, headers: { ...cors, Allow: "POST, OPTIONS" } });
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  if (path === "/mcp" && req.method === "POST") return await handleMcp(auth, req, started);

  if (path === "/v1/me" && req.method === "GET") {
    return json({
      store: { id: auth.token.tenant_id, name: auth.storeName, url: auth.shopUrl },
      token: { name: auth.token.name, scopes: auth.token.scopes, expires_at: auth.token.expires_at },
    });
  }
  if (path === "/v1/tools" && req.method === "GET") {
    return json({
      tools: allowedTools(auth).map((t) => ({ name: t.name, description: t.description, scope: t.scope, input_schema: t.inputSchema })),
    });
  }

  let toolName: string | null = null;
  // deno-lint-ignore no-explicit-any
  let input: any = {};
  const toolMatch = /^\/v1\/tools\/([a-z_]+)$/.exec(path);
  if (toolMatch && req.method === "POST") {
    toolName = toolMatch[1];
    const text = await req.text();
    if (text.trim()) {
      try {
        input = JSON.parse(text);
      } catch {
        return apiError(400, "invalid_json", "El body debe ser JSON.");
      }
    }
  } else if (req.method === "GET") {
    for (const r of REST_ROUTES) {
      const m = r.re.exec(path);
      if (!m) continue;
      toolName = r.tool;
      input = queryArgs(url);
      if (r.idKey) input[r.idKey] = r.numeric && /^\d+$/.test(m[1]) ? Number(m[1]) : m[1];
      break;
    }
  }
  if (!toolName) return apiError(404, "not_found", `Ruta no encontrada: ${req.method} ${path}`);

  const res = await callTool(auth, toolName, input);
  await logCall(auth, req, toolName, res.ok ? 200 : res.status, res.ok ? null : res.message, started);
  return res.ok ? json({ data: res.result }) : apiError(res.status, res.code, res.message);
});

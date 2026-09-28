import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// =============================================================================
// send-order-action — CAT-80: acciones de una orden hacia el CLIENTE FINAL por
// WhatsApp Cloud API, desde el número de LA PLATAFORMA (mismo emisor que
// order_completed). Un click desde el menú ⋯ de Órdenes, sin wa.me.
//
//   action 'notify'  → plantilla `credit_payment_reminder` (recordatorio de
//                      pago; órdenes credit/pending).
//   action 'invoice' → plantilla `order_invoice` (header DOCUMENT = el PDF de
//                      la factura, subido antes a Storage por el front).
//   action 'setup'   → crea ambas plantillas en la WABA (one-off, idempotente;
//                      auth por x-webhook-secret, NO por JWT).
//
// Auth: verify_jwt=false. 'setup' exige x-webhook-secret; notify/invoice exigen
// el JWT del usuario (Authorization Bearer) + membresía en el tenant de la
// orden (users_tenants o team_members accepted — NO alcanza la RLS de orders,
// que es abierta) + plan PAGO (tenants.plan_id != 'gratis'; el costo Meta por
// conversación lo paga la plataforma → gate de planes, decisión 2026-09-24).
// Log: whatsapp_notification_logs (template_type = nombre de la plantilla).
// =============================================================================

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
// WABA de la plataforma (portfolio CatalogoHoy LLC) — para crear plantillas.
const WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") ?? "1038950559044032";
const SETUP_SECRET = "whsec_orderaction_7f2e9b4a1c6d8035ea54b7f2c9d10e86";

const STORAGE_PUBLIC_PREFIX =
  "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/";

const TPL_REMINDER = "credit_payment_reminder";
const TPL_INVOICE = "order_invoice";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function toE164Digits(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** PDF mínimo válido (1 página en blanco) para el header_handle de ejemplo que
 *  Meta exige al crear una plantilla con header DOCUMENT. */
const SAMPLE_PDF_B64 =
  "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0+PmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1MiAwMDAwMCBuIAowMDAwMDAwMTAxIDAwMDAwIG4gCnRyYWlsZXI8PC9TaXplIDQvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoxNjQKJSVFT0Y=";

/** Sube el PDF de muestra por la Upload API y devuelve el header_handle. */
async function uploadSampleHandle(): Promise<string> {
  const bytes = Uint8Array.from(atob(SAMPLE_PDF_B64), (c) => c.charCodeAt(0));
  const start = await fetch(
    `${GRAPH}/app/uploads?file_length=${bytes.length}&file_type=application/pdf&access_token=${WHATSAPP_TOKEN}`,
    { method: "POST" },
  );
  const session = await start.json();
  if (!start.ok || !session.id) {
    throw new Error(`upload session: ${JSON.stringify(session)}`);
  }
  const up = await fetch(`${GRAPH}/${session.id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${WHATSAPP_TOKEN}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  });
  const result = await up.json();
  if (!up.ok || !result.h) throw new Error(`upload: ${JSON.stringify(result)}`);
  return result.h as string;
}

/** Componentes canónicos de las plantillas (copys acordados con Nicolas:
 *  gracias-primero en la factura; el recordatorio deja salida airosa). */
function reminderComponents(): Record<string, unknown>[] {
  return [
    {
      type: "BODY",
      text:
        "Hola {{1}}, {{2}} le recuerda el pago pendiente de su orden #{{3}} por {{4}}. Si ya realizó el pago, puede ignorar este mensaje. ¡Gracias!",
      example: {
        body_text: [[
          "Luis",
          "Distribuidora Moto Fox",
          "67",
          "$85.00 (cuota vencida el 20/09)",
        ]],
      },
    },
  ];
}

function invoiceComponents(handle: string): Record<string, unknown>[] {
  return [
    {
      type: "HEADER",
      format: "DOCUMENT",
      example: { header_handle: [handle] },
    },
    {
      type: "BODY",
      text:
        "Hola {{1}}, ¡gracias por su compra en {{2}}! Aquí tiene la factura de su orden #{{3}} por {{4}}. Quedamos a la orden.",
      example: {
        body_text: [["Luis", "Distribuidora Moto Fox", "67", "$85.00"]],
      },
    },
  ];
}

/** Crea las 2 plantillas UTILITY en la WABA — o, con `editIds`, EDITA las
 *  existentes por id (POST /{template_id}; permitido en PENDING, y borrar
 *  bloquearía los nombres 30 días). Idempotente: "already exists" ok. */
async function setupTemplates(
  editIds?: { reminder?: string; invoice?: string },
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  const post = async (path: string, payload: Record<string, unknown>) => {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (res.ok) return { ok: true, id: body.id, status: body.status, success: body.success };
    const msg = JSON.stringify(body?.error ?? body);
    if (
      msg.includes("already exists") ||
      body?.error?.error_subcode === 2388023 ||
      body?.error?.error_subcode === 2388024
    ) {
      return { ok: false, exists: true };
    }
    return { ok: false, error: msg.slice(0, 500) };
  };

  if (editIds?.reminder) {
    out[TPL_REMINDER] = await post(editIds.reminder, {
      components: reminderComponents(),
    });
  } else {
    out[TPL_REMINDER] = await post(`${WABA_ID}/message_templates`, {
      name: TPL_REMINDER,
      category: "UTILITY",
      language: "es",
      components: reminderComponents(),
    });
  }

  try {
    const handle = await uploadSampleHandle();
    if (editIds?.invoice) {
      out[TPL_INVOICE] = await post(editIds.invoice, {
        components: invoiceComponents(handle),
      });
    } else {
      out[TPL_INVOICE] = await post(`${WABA_ID}/message_templates`, {
        name: TPL_INVOICE,
        category: "UTILITY",
        language: "es",
        components: invoiceComponents(handle),
      });
    }
  } catch (e) {
    out[TPL_INVOICE] = { ok: false, error: String(e).slice(0, 500) };
  }
  return out;
}

// ── Moneda: espejo de TenantCurrencyStore + effectiveOrderBs del front ───────
// El monto respeta la config del catálogo: solo referencia ($/€), solo Bs
// (catálogos 100% bolívares: total_usd YA está en Bs y currency_symbol es
// 'Bs.'), o dual "$X / Bs. Y" (pedido de Nicolas 2026-09-24). Pendientes a
// tasa ACTIVA del catálogo; el resto usa su snapshot total_bs.
type CurrencyCfg = {
  currency_symbol?: string | null;
  show_dual_currency?: boolean | null;
  exchange_rate_type?: string | null;
  custom_rate?: number | null;
  product_currency?: string | null;
};
type GlobalRates = { bcv_usd?: number | null; bcv_eur?: number | null };

function moneyFmt(cfg: CurrencyCfg | null) {
  const ve = cfg?.product_currency === "VES";
  const thou = ve ? "." : ",";
  const dec = ve ? "," : ".";
  return (n: number, symbol: string) => {
    const [i, f] = (Number(n) || 0).toFixed(2).split(".");
    return `${symbol}${i.replace(/\B(?=(\d{3})+(?!\d))/g, thou)}${dec}${f}`;
  };
}

async function loadCurrency(
  admin: ReturnType<typeof createClient>,
  tenantId: number,
): Promise<{ cfg: CurrencyCfg | null; rates: GlobalRates | null }> {
  const [cfgResp, ratesResp] = await Promise.all([
    admin
      .from("tenant_currency_config")
      .select(
        "currency_symbol, show_dual_currency, exchange_rate_type, custom_rate, product_currency",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin.from("exchange_rates").select("bcv_usd, bcv_eur").eq("id", 1).maybeSingle(),
  ]);
  return {
    cfg: (cfgResp.data as CurrencyCfg | null) ?? null,
    rates: (ratesResp.data as GlobalRates | null) ?? null,
  };
}

function activeRateValue(cfg: CurrencyCfg | null, rates: GlobalRates | null): number {
  const type = cfg?.exchange_rate_type ?? "bcv_usd";
  if (type === "custom") return Number(cfg?.custom_rate) || 0;
  if (type === "bcv_eur") return Number(rates?.bcv_eur) || 0;
  return Number(rates?.bcv_usd) || 0;
}

function orderAmountText(
  order: { total_usd?: number | null; total_bs?: number | null; status?: string | null },
  cfg: CurrencyCfg | null,
  rates: GlobalRates | null,
): string {
  const fmt = moneyFmt(cfg);
  const sym = (cfg?.currency_symbol ?? "$").trim() || "$";
  let text = fmt(Number(order.total_usd) || 0, sym);
  if (cfg?.show_dual_currency) {
    let bs = Number(order.total_bs) || 0;
    if (order.status === "pending" || bs <= 0) {
      const rate = activeRateValue(cfg, rates);
      if (rate > 0) bs = (Number(order.total_usd) || 0) * rate;
    }
    if (bs > 0) text += ` / ${moneyFmt({ product_currency: "VES" })(bs, "Bs. ")}`;
  }
  return text;
}

type Payload = {
  action: "notify" | "invoice" | "setup";
  orderId?: number;
  /** invoice: URL pública del PDF ya subido a Storage por el front. */
  pdfUrl?: string;
  pdfFilename?: string;
  /** setup: editar las plantillas existentes por id en vez de crearlas. */
  editIds?: { reminder?: string; invoice?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return json({ success: false, error: "whatsapp_not_configured" }, 500);
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  // ── setup (one-off, server-to-server) ──────────────────────────────────────
  if (body.action === "setup") {
    if (req.headers.get("x-webhook-secret") !== SETUP_SECRET) {
      return json({ success: false, error: "unauthorized" }, 401);
    }
    const result = await setupTemplates(body.editIds);
    return json({ success: true, templates: result });
  }

  // ── notify / invoice (JWT del usuario) ─────────────────────────────────────
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return json({ success: false, error: "unauthorized" }, 401);

  const orderId = Number(body.orderId);
  if (!orderId || (body.action !== "notify" && body.action !== "invoice")) {
    return json({ success: false, error: "bad_request" }, 400);
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, tenant_id, name, phone, order_number, total_usd, total_bs, status, credit_installments")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return json({ success: false, error: "order_not_found" }, 404);

  // Membresía real (la RLS de orders es abierta, acá va el check de verdad).
  const { data: appUser } = await admin
    .from("users")
    .select("id, email")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (!appUser) return json({ success: false, error: "forbidden" }, 403);
  const { data: link } = await admin
    .from("users_tenants")
    .select("user_id")
    .eq("user_id", appUser.id)
    .eq("tenant_id", order.tenant_id)
    .maybeSingle();
  let isMember = !!link;
  if (!isMember) {
    // Miembros de equipo: team_members → teams(tenant_id), status accepted.
    const { data: tm } = await admin
      .from("team_members")
      .select("id, teams!inner(tenant_id)")
      .eq("status", "accepted")
      .or(`user_id.eq.${appUser.id},invited_email.eq.${appUser.email}`)
      .eq("teams.tenant_id", order.tenant_id)
      .limit(1);
    isMember = !!tm?.length;
  }
  if (!isMember) return json({ success: false, error: "forbidden" }, 403);

  // Gate de plan: el envío tiene costo Meta → solo planes pagos.
  const { data: tenant } = await admin
    .from("tenants")
    .select("name, plan_id")
    .eq("id", order.tenant_id)
    .maybeSingle();
  if (!tenant) return json({ success: false, error: "tenant_not_found" }, 404);
  if ((tenant.plan_id ?? "gratis") === "gratis") {
    return json({ success: false, error: "plan_required" }, 403);
  }

  const phone = toE164Digits(order.phone ?? "");
  if (phone.length < 8) return json({ success: false, error: "no_phone" }, 400);

  const { cfg, rates } = await loadCurrency(admin, order.tenant_id);
  const fmt = moneyFmt(cfg);
  const sym = ((cfg?.currency_symbol ?? "$").trim() || "$");
  const amountText = orderAmountText(order, cfg, rates);

  const firstName = (order.name ?? "").trim().split(/\s+/)[0] || "cliente";
  const orderNum = String(order.order_number ?? order.id);
  const business = tenant.name ?? "su tienda";

  let templateName: string;
  const components: Record<string, unknown>[] = [];

  if (body.action === "notify") {
    // Monto + cuota vencida (si el plan de cuotas tiene una impaga pasada).
    const today = new Date().toISOString().slice(0, 10);
    const cuotas = Array.isArray(order.credit_installments) ? order.credit_installments : [];
    const due = cuotas
      .filter((c: { dueDate?: string; paid?: boolean }) =>
        typeof c?.dueDate === "string" && c.paid !== true && c.dueDate < today)
      .sort((a: { dueDate: string }, b: { dueDate: string }) => a.dueDate.localeCompare(b.dueDate))[0];
    let monto = amountText;
    if (due) {
      const [, m, d] = String(due.dueDate).split("-");
      const dueAmt = due.amount != null ? fmt(Number(due.amount), sym) : null;
      monto += ` (cuota${dueAmt ? ` de ${dueAmt}` : ""} vencida el ${d}/${m})`;
    }
    templateName = TPL_REMINDER;
    components.push({
      type: "body",
      parameters: [firstName, business, orderNum, monto].map((text) => ({ type: "text", text })),
    });
  } else {
    const pdfUrl = (body.pdfUrl ?? "").trim();
    if (!pdfUrl.startsWith(STORAGE_PUBLIC_PREFIX)) {
      return json({ success: false, error: "invalid_pdf_url" }, 400);
    }
    templateName = TPL_INVOICE;
    components.push({
      type: "header",
      parameters: [{
        type: "document",
        document: {
          link: pdfUrl,
          filename: body.pdfFilename || `factura-${orderNum}.pdf`,
        },
      }],
    });
    components.push({
      type: "body",
      parameters: [firstName, business, orderNum, amountText]
        .map((text) => ({ type: "text", text })),
    });
  }

  const res = await fetch(`${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: { name: templateName, language: { code: "es" }, components },
    }),
  });
  const result = await res.json();

  // Log best-effort al panel de WhatsApp.
  try {
    await admin.from("whatsapp_notification_logs").insert({
      tenant_id: order.tenant_id,
      template_type: templateName,
      recipient: phone,
      status: res.ok ? "sent" : "failed",
      message_id: result?.messages?.[0]?.id ?? null,
      error: res.ok ? null : JSON.stringify(result?.error ?? result).slice(0, 1000),
      variables: [firstName, business, orderNum],
      url_button_param: body.action === "invoice" ? (body.pdfUrl ?? null) : null,
    });
  } catch (_e) { /* logging nunca rompe el envío */ }

  if (!res.ok) {
    return json(
      { success: false, status: res.status, error: result?.error ?? result },
      502,
    );
  }
  return json({ success: true, messageId: result?.messages?.[0]?.id ?? null });
});

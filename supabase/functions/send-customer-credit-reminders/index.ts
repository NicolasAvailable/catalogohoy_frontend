import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { referenceSymbol } from "../_shared/currency.ts";

// =============================================================================
// send-customer-credit-reminders — Cobranza automática por WhatsApp al CLIENTE
// FINAL (complemento pago `wa_credit_reminders`, pedido de Saúl/Motofox).
//
// Cron diario 13:00 UTC (9 a.m. VE). Por cada tienda con el complemento
// vigente + el envío encendido (customer_reminder_settings.enabled) + plan pago:
//   · toma sus órdenes status='credit' con teléfono,
//   · una orden "debe" si tiene una cuota impaga vencida, o (sin cuotas) si
//     tiene >= start_after_days días,
//   · agrupa por teléfono → UN mensaje por cliente con el total que debe,
//   · respeta every_days (orders.customer_reminded_at), las bajas
//     (customer_reminder_optouts) y un tope de MONTHLY_CAP envíos/mes por tienda.
// Plantilla UTILITY `credit_reminder_auto` (botón "No recibir más
// recordatorios" → wa-webhook guarda la baja). Si todavía no está aprobada por
// Meta, cae a la plantilla manual `credit_payment_reminder` (sin botón).
//
// Body opcional (pruebas): { tenantId?: number, dryRun?: boolean,
//   onlyPhone?: string, ignoreCooldown?: boolean }
//   · { action: "template_setup" } crea la plantilla en la WABA.
//   · { action: "template_status" } muestra su estado en Meta.
// Auth: header x-webhook-secret (mismo patrón que los demás cron jobs).
// =============================================================================

const CRON_SECRET = "whsec_custcredit_7a437d98b1cc5a8c5e39d35ba78bf462";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") ?? "1038950559044032";

const TPL_AUTO = "credit_reminder_auto";
const TPL_FALLBACK = "credit_payment_reminder";
/** Lo que ve el panel interno / el contador del front (no el nombre en Meta). */
const LOG_TYPE = "credit_reminder_auto";
/** Payload del botón: wa-webhook lo reconoce y guarda la baja de esa tienda. */
const STOP_PAYLOAD_PREFIX = "STOP_CR:";
/** Tope de envíos por tienda en 30 días (uso justo del complemento). */
const MONTHLY_CAP = 1000;

type Admin = ReturnType<typeof createClient>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Plantilla ────────────────────────────────────────────────────────────────
function autoTemplateComponents(): Record<string, unknown>[] {
  return [
    {
      type: "BODY",
      text:
        "Hola {{1}}, te escribimos de parte de {{2}}. Tienes un saldo pendiente de {{3}} por {{4}}. " +
        "Si ya pagaste, puedes ignorar este mensaje. Para pagar o cualquier duda, escríbele a {{2}} al {{5}}. ¡Gracias!",
      example: {
        body_text: [[
          "Luis",
          "Distribuidora Moto Fox",
          "$185,00",
          "las órdenes #67 y #70",
          "+58 412-7083537",
        ]],
      },
    },
    { type: "FOOTER", text: "Aviso automático enviado con CatalogoHoy" },
    {
      type: "BUTTONS",
      buttons: [{ type: "QUICK_REPLY", text: "No recibir más recordatorios" }],
    },
  ];
}

async function graph(path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function templateStatus(): Promise<string | null> {
  const r = await graph(`${WABA_ID}/message_templates?name=${TPL_AUTO}&fields=name,status,category,rejected_reason`);
  const row = (r.body?.data ?? []).find((t: { name?: string }) => t?.name === TPL_AUTO);
  return row?.status ?? null;
}

// ── Moneda (espejo de send-order-action) ────────────────────────────────────
type CurrencyCfg = {
  currency_symbol?: string | null;
  display_currency?: string | null;
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

function activeRateValue(cfg: CurrencyCfg | null, rates: GlobalRates | null): number {
  const type = cfg?.exchange_rate_type ?? "bcv_usd";
  if (type === "custom") return Number(cfg?.custom_rate) || 0;
  if (type === "bcv_eur") return Number(rates?.bcv_eur) || 0;
  return Number(rates?.bcv_usd) || 0;
}

/** Deuda total: referencia ($/€) y, si el catálogo es dual, Bs a la tasa ACTIVA
 *  de hoy (es una deuda abierta, el snapshot de la orden puede ser viejo). */
function debtText(totalRef: number, totalBsSnapshot: number, cfg: CurrencyCfg | null, rates: GlobalRates | null) {
  // total_usd está en la moneda de REFERENCIA ($/€), no en currency_symbol (local).
  const sym = referenceSymbol(cfg);
  let text = moneyFmt(cfg)(totalRef, sym);
  if (cfg?.show_dual_currency) {
    const rate = activeRateValue(cfg, rates);
    const bs = rate > 0 ? totalRef * rate : totalBsSnapshot;
    if (bs > 0) text += ` / ${moneyFmt({ product_currency: "VES" })(bs, "Bs. ")}`;
  }
  return text;
}

// ── Teléfonos ────────────────────────────────────────────────────────────────
/** Solo dígitos, con arreglos típicos de VE: "+58 0414…" → 58414…, "0414…" → 58414…. */
function normalizePhone(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("580") && d.length === 13) d = "58" + d.slice(3);
  if (d.startsWith("0") && d.length === 11) d = "58" + d.slice(1);
  return d;
}

/** "+584127083537" → "+58 412-7083537" (otros países: "+" + dígitos). */
function prettyPhone(digits: string): string {
  if (digits.startsWith("58") && digits.length === 12) {
    return `+58 ${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  return `+${digits}`;
}

function ordersPhrase(nums: string[]): string {
  const tags = nums.map((n) => `#${n}`);
  if (tags.length === 1) return `la orden ${tags[0]}`;
  if (tags.length <= 4) {
    return `las órdenes ${tags.slice(0, -1).join(", ")} y ${tags[tags.length - 1]}`;
  }
  return `${tags.length} órdenes (${tags.slice(0, 3).join(", ")} y ${tags.length - 3} más)`;
}

// ── Reglas de deuda ──────────────────────────────────────────────────────────
type Installment = { dueDate?: string; paid?: boolean };
type OrderRow = {
  id: number;
  tenant_id: number;
  name: string | null;
  phone: string | null;
  order_number: number | null;
  total_usd: number | null;
  total_bs: number | null;
  created_at: string;
  credit_installments: Installment[] | null;
  customer_reminded_at: string | null;
};

function isDue(o: OrderRow, today: string, startAfterDays: number): boolean {
  const list = Array.isArray(o.credit_installments) ? o.credit_installments : [];
  if (list.length > 0) {
    return list.some((c) => c && typeof c.dueDate === "string" && c.paid !== true && c.dueDate < today);
  }
  const age = (Date.now() - new Date(o.created_at).getTime()) / 86_400_000;
  return age >= startAfterDays;
}

// ── Envío ────────────────────────────────────────────────────────────────────
async function sendReminder(
  to: string,
  useAuto: boolean,
  tenantId: number,
  vars: { firstName: string; business: string; amount: string; orders: string; contact: string; firstOrder: string },
) {
  const components: Record<string, unknown>[] = useAuto
    ? [
      {
        type: "body",
        parameters: [vars.firstName, vars.business, vars.amount, vars.orders, vars.contact]
          .map((text) => ({ type: "text", text })),
      },
      {
        type: "button",
        sub_type: "quick_reply",
        index: "0",
        parameters: [{ type: "payload", payload: `${STOP_PAYLOAD_PREFIX}${tenantId}` }],
      },
    ]
    : [
      {
        type: "body",
        parameters: [vars.firstName, vars.business, vars.firstOrder, vars.amount]
          .map((text) => ({ type: "text", text })),
      },
    ];
  return await graph(`${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: useAuto ? TPL_AUTO : TPL_FALLBACK, language: { code: "es" }, components },
    }),
  });
}

type TenantJob = { tenant_id: number; start_after_days: number; every_days: number };

async function eligibleTenants(admin: Admin, onlyTenant?: number): Promise<TenantJob[]> {
  let q = admin
    .from("customer_reminder_settings")
    .select("tenant_id, start_after_days, every_days")
    .eq("enabled", true);
  if (onlyTenant) q = q.eq("tenant_id", onlyTenant);
  const { data: settings } = await q;
  if (!settings?.length) return [];
  const ids = settings.map((s) => s.tenant_id);
  const [{ data: addons }, { data: tenants }] = await Promise.all([
    admin.from("tenant_addons").select("tenant_id").eq("addon", "wa_credit_reminders")
      .gt("active_until", new Date().toISOString()).in("tenant_id", ids),
    admin.from("tenants").select("id, plan_id").in("id", ids),
  ]);
  const withAddon = new Set((addons ?? []).map((a) => a.tenant_id));
  const paid = new Set((tenants ?? []).filter((t) => (t.plan_id ?? "gratis") !== "gratis").map((t) => t.id));
  return (settings as TenantJob[]).filter((s) => withAddon.has(s.tenant_id) && paid.has(s.tenant_id));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (req.headers.get("x-webhook-secret") !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return json({ error: "whatsapp_not_configured" }, 500);

  let body: {
    action?: string; tenantId?: number; dryRun?: boolean; onlyPhone?: string; ignoreCooldown?: boolean;
  } = {};
  try { body = await req.json(); } catch { /* cron manda {} */ }

  if (body.action === "template_status") {
    return json({ template: TPL_AUTO, status: await templateStatus() });
  }
  if (body.action === "template_setup") {
    const r = await graph(`${WABA_ID}/message_templates`, {
      method: "POST",
      body: JSON.stringify({ name: TPL_AUTO, category: "UTILITY", language: "es", components: autoTemplateComponents() }),
    });
    return json({ ok: r.ok, result: r.body });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const dryRun = body.dryRun === true;
  const onlyPhone = body.onlyPhone ? normalizePhone(body.onlyPhone) : null;
  const today = new Date().toISOString().slice(0, 10);
  const useAuto = (await templateStatus()) === "APPROVED";

  const jobs = await eligibleTenants(admin, body.tenantId ? Number(body.tenantId) : undefined);
  const { data: rates } = await admin.from("exchange_rates").select("bcv_usd, bcv_eur").eq("id", 1).maybeSingle();

  const report: Record<string, unknown>[] = [];
  let sent = 0, failed = 0;

  for (const job of jobs) {
    const tenantId = job.tenant_id;
    const [{ data: tenant }, { data: cfg }, { data: ecommerce }, { data: optouts }, { count: sent30 }, { data: orders }] =
      await Promise.all([
        admin.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
        admin.from("tenant_currency_config")
          .select("currency_symbol, display_currency, show_dual_currency, exchange_rate_type, custom_rate, product_currency")
          .eq("tenant_id", tenantId).maybeSingle(),
        admin.from("tenant_ecommerce_config").select("whatsapp_buttons").eq("tenant_id", tenantId).maybeSingle(),
        admin.from("customer_reminder_optouts").select("phone").eq("tenant_id", tenantId),
        admin.from("whatsapp_notification_logs").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("template_type", LOG_TYPE).eq("status", "sent")
          .gt("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
        admin.from("orders")
          .select("id, tenant_id, name, phone, order_number, total_usd, total_bs, created_at, credit_installments, customer_reminded_at")
          .eq("tenant_id", tenantId).eq("status", "credit").not("phone", "is", null)
          .order("created_at", { ascending: true }).limit(5000),
      ]);

    const business = (tenant?.name ?? "").trim() || "tu tienda";
    const buttons = Array.isArray(ecommerce?.whatsapp_buttons) ? ecommerce.whatsapp_buttons : [];
    const storePhone = buttons.map((b: { number?: string }) => normalizePhone(b?.number)).find((p: string) => p.length >= 8);
    const contact = storePhone ? prettyPhone(storePhone) : "su WhatsApp de siempre";
    const blocked = new Set((optouts ?? []).map((o) => o.phone));
    let budget = Math.max(0, MONTHLY_CAP - (sent30 ?? 0));

    // Agrupar por cliente (teléfono normalizado).
    const byPhone = new Map<string, OrderRow[]>();
    for (const o of (orders ?? []) as OrderRow[]) {
      const p = normalizePhone(o.phone);
      if (p.length < 10) continue;
      if (onlyPhone && p !== onlyPhone) continue;
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p)!.push(o);
    }

    const cooldownMs = job.every_days * 86_400_000;
    for (const [phone, list] of byPhone) {
      if (blocked.has(phone)) { report.push({ tenantId, phone, skip: "optout" }); continue; }
      const due = list.filter((o) => isDue(o, today, job.start_after_days));
      if (!due.length) continue;
      const lastReminded = Math.max(0, ...list.map((o) => o.customer_reminded_at ? new Date(o.customer_reminded_at).getTime() : 0));
      if (!body.ignoreCooldown && Date.now() - lastReminded < cooldownMs) continue;
      if (budget <= 0) { report.push({ tenantId, phone, skip: "monthly_cap" }); continue; }

      // Total = todas sus órdenes a crédito (lo que debe hoy), no solo las vencidas.
      const totalRef = list.reduce((s, o) => s + (Number(o.total_usd) || 0), 0);
      const totalBs = list.reduce((s, o) => s + (Number(o.total_bs) || 0), 0);
      const nums = list.map((o) => String(o.order_number ?? o.id));
      const latestName = [...list].reverse().find((o) => (o.name ?? "").trim())?.name ?? "";
      const vars = {
        firstName: latestName.trim().split(/\s+/)[0] || "cliente",
        business,
        amount: debtText(totalRef, totalBs, cfg as CurrencyCfg | null, rates as GlobalRates | null),
        orders: ordersPhrase(nums),
        contact,
        firstOrder: nums.length === 1 ? nums[0] : `${nums[0]} (y ${nums.length - 1} más)`,
      };

      if (dryRun) {
        report.push({ tenantId, phone, orders: nums, ...vars, template: useAuto ? TPL_AUTO : TPL_FALLBACK });
        continue;
      }

      const r = await sendReminder(phone, useAuto, tenantId, vars);
      budget--;
      try {
        await admin.from("whatsapp_notification_logs").insert({
          tenant_id: tenantId,
          template_type: LOG_TYPE,
          recipient: phone,
          status: r.ok ? "sent" : "failed",
          message_id: r.body?.messages?.[0]?.id ?? null,
          error: r.ok ? null : JSON.stringify(r.body?.error ?? r.body).slice(0, 1000),
          variables: [vars.firstName, business, vars.amount, vars.orders, useAuto ? TPL_AUTO : TPL_FALLBACK],
        });
      } catch (_e) { /* el log nunca rompe el envío */ }

      if (r.ok) {
        sent++;
        // Marca TODAS las órdenes del cliente: el próximo aviso va en every_days.
        await admin.from("orders").update({ customer_reminded_at: new Date().toISOString() })
          .in("id", list.map((o) => o.id));
      } else {
        failed++;
      }
      report.push({ tenantId, phone, ok: r.ok, orders: nums.length });
    }
  }

  return json({ ok: true, dryRun, template: useAuto ? TPL_AUTO : TPL_FALLBACK, tenants: jobs.length, sent, failed, report });
});

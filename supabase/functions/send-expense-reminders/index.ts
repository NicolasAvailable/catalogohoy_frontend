import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

// =============================================================================
// send-expense-reminders — avisos de facturas de proveedores (Gastos y
// facturas, tabla tenant_expenses). Cron diario (12:30 UTC = 08:30 VE).
//
// Por tienda, junta las facturas POR PAGAR que:
//   - vencen hoy o en los próximos DUE_SOON_DAYS días y no se avisaron
//     (due_reminded_at), o
//   - ya vencieron y no se avisó que vencieron (overdue_reminded_at).
// y manda al dueño UN email (AWS SES, layout de marca) + UN WhatsApp (template
// de plataforma `expense_due_reminder` vía send-whatsapp-notification,
// best-effort). Marca las facturas avisadas: cada factura recibe a lo sumo un
// aviso "por vencer" y uno "vencida" (si cambian la fecha, el trigger de la
// tabla limpia las marcas). Respeta users.notify_expense_reminders (si está
// apagado se marca igual, para no mandar el atraso al volver a encenderlo).
// Auth: header x-webhook-secret = edge secret EXPENSE_REMINDERS_CRON_SECRET (el
// cron lo lee del Vault: `expense_reminders_cron_secret`; nunca en el repo).
// =============================================================================

// Secret del cron: edge secret EXPENSE_REMINDERS_CRON_SECRET (= el del Vault que usa el cron).
const CRON_SECRET = Deno.env.get("EXPENSE_REMINDERS_CRON_SECRET") ?? "";
const FROM_NAME = "CatalogoHoy";
const FROM_EMAIL = "noreply@catalogohoy.com";
/** Avisar cuando falten estos días (o menos) para el vencimiento. */
const DUE_SOON_DAYS = 2;
/** Tope de filas en el email (el resto se resume como "y N más"). */
const MAX_ROWS = 10;
/** Facturas vencidas hace más de esto no se avisan (evita avisos de deudas viejas
 *  cargadas a mano después). */
const MAX_OVERDUE_DAYS = 30;

// --- Layout de marca de emails ----------------------------------------------
// Mismo diseño que las plantillas de Supabase Auth (reset de contraseña, etc.):
// fondo #eaf1ff, card blanca con radio 12px, logo, título #16367f, texto
// #383838 en Arial y botón #3e7bfa con radio 8px. Copia idéntica en cada
// función que manda email: si cambiás algo acá, cambialo en todas.
const BRAND_LOGO_URL = "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/catalogohoy-logo.png";
const BRAND_BLUE = "#3e7bfa";
function brandEsc(v) {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// Botón principal (azul lleno) o secundario (borde azul).
function brandButton(b) {
  const style = b.secondary
    ? `background-color:#ffffff;color:${BRAND_BLUE};border:2px solid ${BRAND_BLUE};padding:12px 24px;`
    : `background-color:${BRAND_BLUE};color:#ffffff;padding:14px 26px;`;
  return `<a href="${brandEsc(b.url)}" style="${style}text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;margin:4px;">${brandEsc(b.label)}</a>`;
}
// Bloque de datos "etiqueta → valor" en caja celeste (para resúmenes).
function brandRows(rows) {
  const trs = rows.map((r, i) => `<tr><td style="padding:10px 0;font-size:14px;color:#383838;${i < rows.length - 1 ? "border-bottom:1px solid #dfe8fb;" : ""}">${r.labelHtml ?? brandEsc(r.label)}</td><td align="right" style="padding:10px 0;font-size:14px;font-weight:bold;color:${r.color || "#16367f"};${i < rows.length - 1 ? "border-bottom:1px solid #dfe8fb;" : ""}">${r.valueHtml ?? brandEsc(r.value)}</td></tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ff;border-radius:8px;padding:6px 16px;margin:4px 0 8px;">${trs}</table>`;
}
// Subtítulo de sección dentro del cuerpo.
function brandSection(title) {
  return `<p style="margin:22px 0 8px;font-size:13px;font-weight:bold;color:#16367f;text-transform:uppercase;letter-spacing:.04em;">${brandEsc(title)}</p>`;
}
// opts: { title, subtitle?, bodyHtml, buttons?: [{label,url,secondary?}], note?, footer?, width? }
function brandEmail(opts) {
  const width = opts.width || 480;
  const subtitle = opts.subtitle
    ? `<tr><td style="font-size:13px;color:#646464;text-align:center;padding-bottom:20px;">${brandEsc(opts.subtitle)}</td></tr>`
    : "";
  const buttons = opts.buttons && opts.buttons.length
    ? `<tr><td align="center" style="padding-bottom:30px;">${opts.buttons.map(brandButton).join("")}</td></tr>`
    : "";
  const note = opts.note
    ? `<tr><td style="font-size:13px;color:#646464;text-align:center;padding-bottom:15px;line-height:1.5;">${opts.note}</td></tr>`
    : "";
  const footerExtra = opts.footer ? `${opts.footer}<br />` : "";
  return `<!DOCTYPE html>
<html lang="es" style="margin:0;padding:0;background:#eaf1ff;">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /><title>${brandEsc(opts.title)}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#eaf1ff;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eaf1ff;padding:40px 12px;"><tr><td align="center">
<table width="${width}" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:12px;padding:40px 30px;box-shadow:0 4px 10px rgba(0,0,0,0.06);font-family:Arial,Helvetica,sans-serif;">
<tr><td align="center" style="padding-bottom:20px;"><img src="${BRAND_LOGO_URL}" alt="CatalogoHoy" width="90" style="display:block;" /></td></tr>
<tr><td style="font-size:22px;font-weight:bold;color:#16367f;text-align:center;padding-bottom:${opts.subtitle ? "6px" : "10px"};">${brandEsc(opts.title)}</td></tr>
${subtitle}
<tr><td style="font-size:15px;color:#383838;text-align:left;line-height:1.6;padding-bottom:25px;">${opts.bodyHtml}</td></tr>
${buttons}
${note}
<tr><td style="font-size:12px;color:#a6a6a6;text-align:center;padding-top:25px;line-height:1.6;">${footerExtra}© ${new Date().getFullYear()} CatalogoHoy — Todos los derechos reservados.</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}
// ---------------------------------------------------------------------------
// Destinatarios que SES no puede entregar y se saltan sin llamar a SES (cada
// intento suma un rebote a la reputación de la cuenta): el relay de Apple
// "Ocultar mi correo" (@privaterelay.appleid.com rechaza a remitentes no
// registrados en Apple con "550 unauthorized sender"), dominios de prueba y
// typos frecuentes de gmail/hotmail. Copia idéntica en cada función que manda
// email: si cambiás algo acá, cambialo en todas.
const UNDELIVERABLE_EMAIL_DOMAINS = new Set([
  "privaterelay.appleid.com",
  "example.com", "example.org", "example.net",
  "gmail.comm", "gmail.co.com", "gmail.vom", "gmail.con", "gmail.cm", "gmailcom",
  "gamil.com", "gmial.com", "hitmail.com", "hotmal.com", "hotmail.con"
]);
function isUndeliverableEmail(email: unknown): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return true;
  const domain = e.slice(at + 1);
  if (!domain.includes(".")) return true;
  if (UNDELIVERABLE_EMAIL_DOMAINS.has(domain)) return true;
  return /\.(test|invalid|local|localhost|example)$/.test(domain);
}
async function sendViaSes(to, subject, html, text) {
  if (isUndeliverableEmail(to)) return { ok: false, status: 0, error: "undeliverable recipient" };
  const region = Deno.env.get("AWS_SES_REGION") ?? "sa-east-1";
  const aws = new AwsClient({
    accessKeyId: Deno.env.get("AWS_SES_ACCESS_KEY_ID"),
    secretAccessKey: Deno.env.get("AWS_SES_SECRET_ACCESS_KEY"),
    region, service: "ses",
  });
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FromEmailAddress: `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: { ToAddresses: [to] },
      Content: { Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Html: { Data: html, Charset: "UTF-8" }, Text: { Data: text, Charset: "UTF-8" } },
      } },
      ConfigurationSetName: "catalogohoy-prod",
    }),
  });
  if (!res.ok) throw new Error(`SES ${res.status}: ${await res.text()}`);
}


// ---------------------------------------------------------------------------

type ExpenseRow = {
  id: string;
  tenant_id: number;
  supplier: string | null;
  description: string | null;
  invoice_number: string | null;
  amount: number;
  currency: string;
  due_date: string;
  due_reminded_at: string | null;
  overdue_reminded_at: string | null;
};

function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const [, m, d] = String(iso).split("-");
  return d && m ? `${d}/${m}` : String(iso);
}

const SYMBOLS: Record<string, string> = { USD: "$", VES: "Bs", EUR: "€", COP: "$", MXN: "$", DOP: "RD$", PEN: "S/", ARS: "$", CLP: "$" };
function money(amount: number, currency: string): string {
  const value = Number(amount).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${SYMBOLS[currency] ?? currency}\u00a0${value}`;
}

/** Totales por moneda: "$ 530,00 + Bs 15.000,00". */
function totalsText(rows: ExpenseRow[]): string {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.currency, (map.get(r.currency) ?? 0) + Number(r.amount));
  return [...map.entries()].map(([c, t]) => money(t, c)).join(" + ");
}

async function fetchOwner(admin: ReturnType<typeof createClient>, tenantId: number) {
  const [tenantResp, linkResp] = await Promise.all([
    admin.from("tenants").select("name, slug").eq("id", tenantId).maybeSingle(),
    admin
      .from("users_tenants")
      .select("users!inner(name, last_name, email, notify_expense_reminders)")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!tenantResp.data) return null;
  // deno-lint-ignore no-explicit-any
  const user = (linkResp.data as any)?.users ?? null;
  const email = String(user?.email ?? "").trim();
  return {
    email: email.includes("@") ? email : null,
    firstName: String(user?.name ?? "").trim().split(" ")[0] || null,
    enabled: user?.notify_expense_reminders !== false,
    tenantName: tenantResp.data.name ?? `Tienda #${tenantId}`,
    slug: tenantResp.data.slug ?? String(tenantId),
  };
}

async function sendWhatsApp(
  admin: ReturnType<typeof createClient>,
  tenantId: number,
  variables: string[]
): Promise<boolean> {
  const waSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  if (!waSecret) return false;
  const { data: recipient } = await admin.rpc("resolve_billing_wa_recipient", {
    p_tenant_id: tenantId,
    p_type: "expense_due_reminder",
  });
  if (!recipient) return false;
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": waSecret },
      body: JSON.stringify({ tenantId, to: recipient, templateType: "expense_due_reminder", variables }),
    });
    const j = await res.json().catch(() => null);
    return res.ok && j?.success === true && !j?.skipped;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-webhook-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const today = isoDay(0);
  const soon = isoDay(DUE_SOON_DAYS);
  const oldest = isoDay(-MAX_OVERDUE_DAYS);
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";

  const { data, error } = await admin
    .from("tenant_expenses")
    .select("id, tenant_id, supplier, description, invoice_number, amount, currency, due_date, due_reminded_at, overdue_reminded_at")
    .eq("status", "pending")
    .not("due_date", "is", null)
    .gte("due_date", oldest)
    .lte("due_date", soon)
    .order("due_date", { ascending: true })
    .limit(5000);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  const rows = (data ?? []) as ExpenseRow[];
  const dueSoon = rows.filter((r) => r.due_date >= today && !r.due_reminded_at);
  const overdue = rows.filter((r) => r.due_date < today && !r.overdue_reminded_at);

  const byTenant = new Map<number, { soon: ExpenseRow[]; overdue: ExpenseRow[] }>();
  for (const r of dueSoon) {
    if (!byTenant.has(r.tenant_id)) byTenant.set(r.tenant_id, { soon: [], overdue: [] });
    byTenant.get(r.tenant_id)!.soon.push(r);
  }
  for (const r of overdue) {
    if (!byTenant.has(r.tenant_id)) byTenant.set(r.tenant_id, { soon: [], overdue: [] });
    byTenant.get(r.tenant_id)!.overdue.push(r);
  }

  let emails = 0;
  let whatsapps = 0;
  const soonIds: string[] = [];
  const overdueIds: string[] = [];
  const summary: Record<string, unknown>[] = [];

  for (const [tenantId, group] of byTenant) {
    const owner = await fetchOwner(admin, tenantId);
    const all = [...group.overdue, ...group.soon];
    const markThis = () => {
      soonIds.push(...group.soon.map((r) => r.id));
      overdueIds.push(...group.overdue.map((r) => r.id));
    };
    if (!owner || !owner.enabled) {
      markThis();
      summary.push({ tenantId, skipped: owner ? "disabled" : "no owner" });
      continue;
    }

    const label = (r: ExpenseRow) =>
      [r.supplier || r.description || "Factura", r.invoice_number ? `Nº ${r.invoice_number}` : null]
        .filter(Boolean)
        .join(" · ");
    const shown = all.slice(0, MAX_ROWS);
    const tableRows = shown.map((r) => {
      const late = r.due_date < today;
      const when = late
        ? `venció ${shortDate(r.due_date)}`
        : r.due_date === today
          ? "vence hoy"
          : `vence ${shortDate(r.due_date)}`;
      return {
        label: `${label(r)} (${when})`,
        value: money(r.amount, r.currency),
        color: late ? "#dc2626" : undefined,
      };
    });
    if (all.length > shown.length) {
      tableRows.push({ label: `… y ${all.length - shown.length} más`, value: "", color: undefined });
    }

    const parts: string[] = [];
    if (group.overdue.length) parts.push(`${group.overdue.length} vencida${group.overdue.length > 1 ? "s" : ""}`);
    if (group.soon.length) parts.push(`${group.soon.length} por vencer`);
    const headline = group.overdue.length ? "Tienes facturas vencidas" : "Tienes facturas por vencer";
    const intro = `En ${owner.tenantName} tienes ${parts.join(" y ")} por un total de ${totalsText(all)}.`;
    const url = `https://${owner.slug}.catalogohoy.com/admin/expenses`;
    const greeting = owner.firstName ? `Hola ${brandEsc(owner.firstName)},` : "Hola,";

    const html = brandEmail({
      title: headline,
      subtitle: owner.tenantName,
      bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p><p style="margin:0 0 18px;">${brandEsc(intro)}</p>${brandRows(tableRows)}`,
      buttons: [{ label: "Ver gastos y facturas", url }],
      footer: `Recibiste este email porque eres dueño del catálogo <strong>${brandEsc(owner.tenantName)}</strong>. Puedes apagar estos avisos en Perfil → Notificaciones.`,
    });
    const text = `${headline}\n\n${intro}\n\n${tableRows.map((r) => `- ${r.label}: ${r.value}`).join("\n")}\n\nVer: ${url}`;

    let emailOk = false;
    let waOk = false;
    if (!dryRun) {
      if (owner.email) {
        try {
          const r = await sendViaSes(owner.email, `${headline} · ${owner.tenantName}`, html, text);
          emailOk = !(r && r.ok === false);
          if (emailOk) emails++;
        } catch (e) {
          console.error("SES error", tenantId, e instanceof Error ? e.message : e);
        }
      }
      waOk = await sendWhatsApp(admin, tenantId, [
        owner.firstName || owner.tenantName,
        parts.join(" y "),
        owner.tenantName,
      ]);
      if (waOk) whatsapps++;
    }
    markThis();
    summary.push({ tenantId, soon: group.soon.length, overdue: group.overdue.length, emailOk, waOk });
  }

  if (!dryRun) {
    const now = new Date().toISOString();
    if (soonIds.length) await admin.from("tenant_expenses").update({ due_reminded_at: now }).in("id", soonIds);
    if (overdueIds.length) await admin.from("tenant_expenses").update({ overdue_reminded_at: now }).in("id", overdueIds);
  }

  return new Response(
    JSON.stringify({ ok: true, dryRun, tenants: byTenant.size, emails, whatsapps, summary }),
    { headers: { "Content-Type": "application/json" } }
  );
});

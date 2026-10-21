import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";
// Reporte semanal por email. Lo dispara el cron de los domingos (con
// x-webhook-secret). Para cada catalogo de plan PAGO con el toggle activo:
// arma el snapshot de la semana (y la anterior, para comparativa), suma metricas
// extra + trafico de PostHog, renderiza el email y lo manda por email
// (MailerSend con fallback a Resend) al dueno + miembros del equipo con permiso
// ordenes:view.
//
// Modo TEST: body { tenantId, testEmail } -> procesa solo ese tenant y manda
// solo a testEmail (sin registrar idempotencia). Para verificar sin spamear.
const INTERNAL_WEBHOOK_SECRET = "whsec_weekly_report_5e2a9d4c8b1f7036";
const POSTHOG_HOST = "https://us.posthog.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret"
};
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];
const DIAS = [
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
  "Dom"
];
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
function esc(v) {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function money(sym, n) {
  const num = Number(n) || 0;
  const fixed = (Math.round(num * 100) / 100).toFixed(2);
  const [int, dec] = fixed.split(".");
  return `${sym}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}
function num(n) {
  return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function pct(cur, prev) {
  if (prev > 0) return Math.round((cur - prev) / prev * 100);
  return cur > 0 ? 100 : 0;
}
function deltaChip(p) {
  const up = p >= 0;
  return `<p style="margin:0;font-size:12px;font-weight:700;color:${up ? "#059669" : "#dc2626"};">${up ? "▲" : "▼"} ${Math.abs(p)}%</p>`;
}
function dm(d) {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
async function fetchTraffic(slug, startStr, endStr) {
  const key = Deno.env.get("POSTHOG_PERSONAL_KEY");
  if (!key) return null;
  const q = `SELECT count() AS pageviews, count(DISTINCT distinct_id) AS visitors FROM events WHERE event = '$pageview' AND properties.tenant_slug = '${slug}' AND timestamp >= toDateTime('${startStr}') AND timestamp < toDateTime('${endStr}')`;
  try {
    const res = await fetch(`${POSTHOG_HOST}/api/projects/@current/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: q
        }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const row = data?.results?.[0];
    if (!row) return null;
    return {
      pageviews: Number(row[0]) || 0,
      visitors: Number(row[1]) || 0
    };
  } catch  {
    return null;
  }
}
function render(cand, snap, prev, extras, traffic, greetingName, start, end, ctaUrl) {
  const theme = BRAND_BLUE;
  const sym = cand.display_symbol || "$";
  const lastDay = new Date(end);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  const periodLabel = `${dm(start)} – ${dm(lastDay)} ${lastDay.getUTCFullYear()}`;
  const sales = snap.sales?.total ?? 0;
  const orders = snap.orders?.total ?? 0;
  const ticket = snap.sales?.avgTicket ?? 0;
  const prevSales = prev?.sales?.total ?? 0;
  const prevOrders = prev?.orders?.total ?? 0;
  const prevTicket = prev?.sales?.avgTicket ?? 0;
  const salesPct = pct(sales, prevSales);
  const ticketPct = pct(ticket, prevTicket);
  const ordersDelta = orders - prevOrders;
  const st = snap.orders?.byStatus ?? {};
  const statusLine = `${st["completed"] ?? 0} completadas · ${st["pending"] ?? 0} pendientes · ${st["cancelled"] ?? 0} canceladas`;
  // Hero editorial: una frase con el dato clave (en vez del titular en caja).
  let hero;
  if (prevSales > 0 && salesPct >= 0) hero = `Cerraste la semana con <span style="color:#059669;">${money(sym, sales)}</span> en ventas, un <span style="color:#059669;">+${salesPct}%</span> frente a la anterior.`;
  else if (prevSales > 0 && salesPct < 0) hero = `Cerraste la semana con <span style="color:#0f172a;">${money(sym, sales)}</span> en ventas, un <span style="color:#dc2626;">${salesPct}%</span> frente a la anterior.`;
  else if (sales > 0) hero = `Cerraste la semana con <span style="color:#0f172a;">${money(sym, sales)}</span> en ventas.`;
  else hero = `Esta semana sin ventas — un buen momento para darle movimiento al catálogo.`;
  // Deltas como texto chico (▲ / ▼ / —).
  const deltaTxt = (p) => p > 0 ? `<p style="margin:0;font-size:12px;font-weight:700;color:#16a34a;">▲ ${p}%</p>` : p < 0 ? `<p style="margin:0;font-size:12px;font-weight:700;color:#dc2626;">▼ ${Math.abs(p)}%</p>` : `<p style="margin:0;font-size:12px;font-weight:700;color:#94a3b8;">— 0%</p>`;
  const noPrev = `<p style="margin:0;font-size:12px;font-weight:700;color:#cbd5e1;">—</p>`;
  const salesDelta = prevSales > 0 ? deltaTxt(salesPct) : noPrev;
  const ticketDelta = prevTicket > 0 ? deltaTxt(ticketPct) : noPrev;
  const ordersDeltaTxt = ordersDelta > 0 ? `<p style="margin:0;font-size:12px;font-weight:700;color:#16a34a;">▲ ${ordersDelta}</p>` : ordersDelta < 0 ? `<p style="margin:0;font-size:12px;font-weight:700;color:#dc2626;">▼ ${Math.abs(ordersDelta)}</p>` : `<p style="margin:0;font-size:12px;font-weight:700;color:#cbd5e1;">—</p>`;
  // Ventas por dia (7 dias)
  const byDay = new Map((snap.sales?.byDay ?? []).map((d) => [d.date, Number(d.total) || 0]));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    days.push({ label: DIAS[i], total: byDay.get(ymd(d)) ?? 0 });
  }
  const maxDay = Math.max(...days.map((d) => d.total), 1);
  const peak = Math.max(...days.map((d) => d.total));
  const barsHtml = days.map((d) => {
    const w = Math.round(d.total / maxDay * 100);
    const isPeak = d.total === peak && d.total > 0;
    return `<tr><td style="padding:4px 0;font-size:12px;color:${isPeak ? "#0f172a" : "#64748b"};width:38px;${isPeak ? "font-weight:600;" : ""}">${d.label}</td><td style="padding:4px 0;"><div style="background:${isPeak ? theme : theme + "59"};height:8px;width:${Math.max(w, 2)}%;border-radius:4px;"></div></td><td align="right" style="padding:4px 0;font-size:12px;color:${isPeak ? "#0f172a" : "#334155"};width:56px;font-variant-numeric:tabular-nums;${isPeak ? "font-weight:700;" : ""}">${money(sym, d.total)}</td></tr>`;
  }).join("");
  const topHtml = (snap.topProducts ?? []).slice(0, 5).map((p, i) => `<tr><td style="padding:11px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;"><span style="color:#cbd5e1;font-weight:700;">${String(i + 1).padStart(2, "0")}</span>&nbsp;&nbsp;${esc(p.name)}</td><td align="right" style="padding:11px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;white-space:nowrap;font-variant-numeric:tabular-nums;">${num(p.quantity)} uds · <strong style="color:#0f172a;">${money(sym, p.revenue)}</strong></td></tr>`).join("") || `<tr><td style="padding:11px 0;font-size:13px;color:#94a3b8;">Sin ventas de productos esta semana.</td></tr>`;
  let trafficHtml = "";
  if (traffic) {
    const conv = traffic.visitors > 0 ? (orders / traffic.visitors * 100).toFixed(1).replace(".", ",") : "0,0";
    trafficHtml = `<p style="margin:0 0 12px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:#16367f;">Tráfico del catálogo</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f7ff;border-radius:8px;margin-bottom:28px;"><tr>
      <td width="33%" style="padding:14px 10px 14px 16px;" valign="top"><p style="margin:0;font-size:19px;font-weight:bold;color:#16367f;font-variant-numeric:tabular-nums;">${num(traffic.pageviews)}</p><p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">Visitas</p></td>
      <td width="33%" style="padding:14px 10px;border-left:1px solid #dfe8fb;" valign="top"><p style="margin:0;font-size:19px;font-weight:bold;color:#16367f;font-variant-numeric:tabular-nums;">${num(traffic.visitors)}</p><p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">Visitantes</p></td>
      <td width="33%" style="padding:14px 16px 14px 10px;border-left:1px solid #dfe8fb;" valign="top"><p style="margin:0;font-size:19px;font-weight:bold;color:#16367f;font-variant-numeric:tabular-nums;">${conv}%</p><p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">Conversión</p></td>
    </tr></table>`;
  }
  const bsLine = cand.show_bs && (snap.sales?.totalBs ?? 0) > 0 ? `<span style="font-size:12px;font-weight:500;color:#94a3b8;"> · Bs. ${money("", snap.sales.totalBs)}</span>` : "";
  const greetLine = greetingName ? `Hola ${esc(greetingName.split(" ")[0])},` : "Hola,";
  return brandEmail({
    title: "Tu resumen semanal",
    subtitle: `${cand.tenant_name} · ${periodLabel}`,
    width: 560,
    bodyHtml: `
    <p style="margin:0 0 6px;">${greetLine}</p>
    <p style="margin:0 0 22px;font-size:18px;line-height:1.4;font-weight:bold;color:#16367f;">${hero}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f7ff;border-radius:8px;"><tr>
      <td width="33%" style="padding:16px 10px 16px 16px;" valign="top">
        <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;">Ventas</p>
        <p style="margin:5px 0 3px;font-size:20px;font-weight:bold;color:#16367f;font-variant-numeric:tabular-nums;">${money(sym, sales)}</p>
        ${salesDelta}${bsLine}
      </td>
      <td width="33%" style="padding:16px 10px;border-left:1px solid #dfe8fb;" valign="top">
        <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;">Órdenes</p>
        <p style="margin:5px 0 3px;font-size:20px;font-weight:bold;color:#16367f;font-variant-numeric:tabular-nums;">${num(orders)}</p>
        ${ordersDeltaTxt}
      </td>
      <td width="33%" style="padding:16px 16px 16px 10px;border-left:1px solid #dfe8fb;" valign="top">
        <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;">Ticket prom.</p>
        <p style="margin:5px 0 3px;font-size:20px;font-weight:bold;color:#16367f;font-variant-numeric:tabular-nums;">${money(sym, ticket)}</p>
        ${ticketDelta}
      </td>
    </tr></table>
    <p style="margin:12px 0 26px;font-size:12px;color:#94a3b8;">${statusLine}</p>
    <p style="margin:0 0 12px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:#16367f;">Ventas por día</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:28px;">${barsHtml}</table>
    <p style="margin:0 0 4px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:#16367f;">Top productos</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:28px;">${topHtml}</table>
    ${trafficHtml}
    <p style="margin:0 0 4px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:#16367f;">Clientes y pendientes</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:8px;">
      <tr><td style="padding:11px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;">Clientes nuevos</td><td align="right" style="padding:11px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${num(extras.newCustomers)}</td></tr>
      <tr><td style="padding:11px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ea580c;margin-right:8px;"></span>Órdenes pendientes</td><td align="right" style="padding:11px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#ea580c;font-variant-numeric:tabular-nums;">${st["pending"] ?? 0}</td></tr>
      <tr><td style="padding:11px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${(extras.outOfStock ?? 0) > 0 ? "#dc2626" : "#cbd5e1"};margin-right:8px;"></span>Productos agotados</td><td align="right" style="padding:11px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:${(extras.outOfStock ?? 0) > 0 ? "#dc2626" : "#0f172a"};font-variant-numeric:tabular-nums;">${num(extras.outOfStock)}</td></tr>
      <tr><td style="padding:11px 0;font-size:14px;color:#475569;">Entregas próxima semana</td><td align="right" style="padding:11px 0;font-size:14px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${num(extras.upcomingDeliveries)}</td></tr>
    </table>
`,
    buttons: [{ label: "Ver mis reportes", url: ctaUrl }],
    footer: `Recibes este resumen porque tienes activadas las notificaciones de <strong>${esc(cand.tenant_name)}</strong>. Puedes desactivarlo desde Editar catálogo → Notificaciones.`
  });
}
// --- Email (MailerSend con fallback a Resend) ---------------------------------
// Usa MailerSend si MAILER_SEND_API_KEY está seteado; si no, cae a Resend con
// RESEND_API_KEY. El switch es por presencia del token: se deploya sin romper
// nada y se flipea a MailerSend seteando el secret cuando el dominio esté
// verificado. MailerSend responde 202 y el id viene en el header x-message-id.
function hasEmailProvider() {
  return !!(Deno.env.get("AWS_SES_ACCESS_KEY_ID") || Deno.env.get("MAILER_SEND_API_KEY") || Deno.env.get("RESEND_API_KEY"));
}
// AWS SES (v2 SendEmail, SigV4 con aws4fetch). Proveedor principal: se activa por
// presencia de AWS_SES_ACCESS_KEY_ID (prioridad sobre MailerSend/Resend).
async function sendViaSes(to, fromName, fromEmail, subject, html, text) {
  const region = Deno.env.get("AWS_SES_REGION") ?? "sa-east-1";
  const aws = new AwsClient({
    accessKeyId: Deno.env.get("AWS_SES_ACCESS_KEY_ID"),
    secretAccessKey: Deno.env.get("AWS_SES_SECRET_ACCESS_KEY"),
    region,
    service: "ses"
  });
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      FromEmailAddress: `${fromName} <${fromEmail}>`,
      Destination: {
        ToAddresses: to
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: "UTF-8"
          },
          Body: {
            Html: {
              Data: html,
              Charset: "UTF-8"
            },
            ...text ? {
              Text: {
                Data: text,
                Charset: "UTF-8"
              }
            } : {}
          }
        }
      },
      ConfigurationSetName: "catalogohoy-prod"
    })
  });
  if (!res.ok) return {
    ok: false,
    id: null,
    status: res.status,
    error: await res.text().catch(()=>"")
  };
  const j = await res.json().catch(()=>null);
  return {
    ok: true,
    id: j?.MessageId ?? null,
    status: res.status
  };
}
async function deliverEmail(opts) {
  const to = (Array.isArray(opts.to) ? opts.to : [
    opts.to
  ]).filter((e)=>e && e.includes("@"));
  if (to.length === 0) return {
    ok: false,
    id: null,
    status: 0,
    error: "no recipients"
  };
  const fromName = opts.fromName ?? "CatalogoHoy";
  const fromEmail = opts.fromEmail ?? "noreply@catalogohoy.com";
  if (Deno.env.get("AWS_SES_ACCESS_KEY_ID") && Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")) {
    return await sendViaSes(to, fromName, fromEmail, opts.subject, opts.html, opts.text);
  }
  const msToken = Deno.env.get("MAILER_SEND_API_KEY");
  if (msToken) {
    const res = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${msToken}`,
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({
        from: {
          email: fromEmail,
          name: fromName
        },
        to: to.map((email)=>({
            email
          })),
        subject: opts.subject,
        html: opts.html,
        ...opts.text ? {
          text: opts.text
        } : {}
      })
    });
    const id = res.headers.get("x-message-id");
    if (!res.ok) return {
      ok: false,
      id,
      status: res.status,
      error: await res.text().catch(()=>"")
    };
    return {
      ok: true,
      id,
      status: res.status
    };
  }
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject: opts.subject,
        html: opts.html,
        ...opts.text ? {
          text: opts.text
        } : {}
      })
    });
    if (!res.ok) return {
      ok: false,
      id: null,
      status: res.status,
      error: await res.text().catch(()=>"")
    };
    const j = await res.json().catch(()=>null);
    return {
      ok: true,
      id: j?.id ?? null,
      status: res.status
    };
  }
  return {
    ok: false,
    id: null,
    status: 0,
    error: "No email provider (MAILER_SEND_API_KEY / RESEND_API_KEY)"
  };
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    headers: CORS
  });
  if (req.headers.get("x-webhook-secret") !== INTERNAL_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({
      error: "Unauthorized"
    }), {
      status: 401,
      headers: {
        ...CORS,
        "Content-Type": "application/json"
      }
    });
  }
  const body = await req.json().catch(()=>({}));
  const isTest = !!body.testEmail;
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!hasEmailProvider()) return new Response(JSON.stringify({
    error: "No email provider configured"
  }), {
    status: 500,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
  // Periodo: semana que cierra (lun 00:00 -> lun 00:00 UTC). Al correr el domingo,
  // "manana 00:00" = lunes 00:00, y restamos 7 dias -> lunes anterior.
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const startStr = start.toISOString().slice(0, 19).replace("T", " ");
  const endStr = end.toISOString().slice(0, 19).replace("T", " ");
  const weekStart = ymd(start);
  const { data: candRows, error: candErr } = await admin.rpc("weekly_report_candidates", {
    p_start: start.toISOString(),
    p_end: end.toISOString()
  });
  if (candErr) return new Response(JSON.stringify({
    error: candErr.message
  }), {
    status: 500,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
  let candidates = candRows ?? [];
  if (isTest && body.tenantId) candidates = candidates.filter((c)=>c.tenant_id === body.tenantId);
  const summary = [];
  for (const cand of candidates){
    try {
      const { data: snap } = await admin.rpc("build_report_snapshot", {
        p_tenant_id: cand.tenant_id,
        p_period_start: start.toISOString(),
        p_period_end: end.toISOString()
      });
      if (!snap) {
        summary.push({
          tenant: cand.tenant_id,
          skipped: "no snapshot"
        });
        continue;
      }
      const { data: prev } = await admin.rpc("build_report_snapshot", {
        p_tenant_id: cand.tenant_id,
        p_period_start: prevStart.toISOString(),
        p_period_end: start.toISOString()
      });
      const { data: extrasRaw } = await admin.rpc("weekly_report_extras", {
        p_tenant_id: cand.tenant_id,
        p_start: start.toISOString(),
        p_end: end.toISOString()
      });
      const extras = extrasRaw ?? {};
      const traffic = await fetchTraffic(cand.slug, startStr, endStr);
      const host = cand.custom_domain ?? `${cand.slug}.catalogohoy.com`;
      const ctaUrl = `https://${host}/admin/reports`;
      let recipients;
      if (isTest) {
        recipients = [
          {
            recipient_email: body.testEmail,
            recipient_name: "Test"
          }
        ];
      } else {
        const { data: recs } = await admin.rpc("weekly_report_recipients", {
          p_tenant_id: cand.tenant_id
        });
        recipients = recs ?? [];
      }
      for (const r of recipients){
        if (!isTest) {
          const { data: existing } = await admin.from("weekly_report_sends").select("id").eq("tenant_id", cand.tenant_id).eq("week_start", weekStart).eq("recipient_email", r.recipient_email).maybeSingle();
          if (existing) {
            summary.push({
              tenant: cand.tenant_id,
              email: r.recipient_email,
              skipped: "already sent"
            });
            continue;
          }
        }
        const html = render(cand, snap, prev ?? null, extras, traffic, r.recipient_name, start, end, ctaUrl);
        const emailRes = await deliverEmail({
          to: r.recipient_email,
          subject: `📊 Tu resumen semanal — ${cand.tenant_name}`,
          html
        });
        if (!emailRes.ok) {
          summary.push({
            tenant: cand.tenant_id,
            email: r.recipient_email,
            error: emailRes.error ?? String(emailRes.status)
          });
          continue;
        }
        if (!isTest) await admin.from("weekly_report_sends").insert({
          tenant_id: cand.tenant_id,
          week_start: weekStart,
          recipient_email: r.recipient_email
        });
        summary.push({
          tenant: cand.tenant_id,
          email: r.recipient_email,
          sent: true
        });
      }
    } catch (err) {
      summary.push({
        tenant: cand.tenant_id,
        error: String(err)
      });
    }
  }
  return new Response(JSON.stringify({
    test: isTest,
    period: {
      start: startStr,
      end: endStr
    },
    count: candidates.length,
    summary
  }), {
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
});

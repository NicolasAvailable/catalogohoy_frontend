import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret"
};
const INTERNAL_WEBHOOK_SECRET = "whsec_orders_3a8f7c2e1b9d5046c8e4a1f3b7d2980c";
function escape(input) {
  if (input == null) return "";
  return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatMoney(amount, decimals = 2) {
  return amount.toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function buildOrdersUrl(ctx) {
  const host = ctx.custom_domain ?? `${ctx.slug}.catalogohoy.com`;
  return `https://${host}/admin/orders`;
}
function renderEmail(order, ctx) {
  const subject = `🛍️ Nuevo pedido en ${ctx.tenant_name} — ${order.name}`;
  const themeColor = ctx.theme_color || "#4f46e5";
  const ordersUrl = buildOrdersUrl(ctx);
  const brandMark = ctx.logo
    ? `<img src="${escape(ctx.logo)}" alt="${escape(ctx.tenant_name)}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:9px;object-fit:cover;" />`
    : `<div style="width:40px;height:40px;border-radius:9px;background:${themeColor}1A;text-align:center;line-height:40px;font-size:17px;font-weight:800;color:${themeColor};">${escape(ctx.tenant_name.charAt(0))}</div>`;
  const rows = [];
  rows.push({ label: "Cliente", value: escape(order.name) });
  if (order.phone) rows.push({ label: "Teléfono", value: `<a href="https://wa.me/${escape(order.phone.replace(/\D/g, ""))}" style="color:${themeColor};text-decoration:none;">${escape(order.phone)}</a>` });
  if (order.delivery_date) rows.push({ label: "Fecha de entrega", value: escape(order.delivery_date) });
  if (order.payment_method) rows.push({ label: "Método de pago", value: escape(order.payment_method) });
  const detailHtml = rows.map((r, i) => {
    const divider = i === 0 ? "" : `<tr><td colspan="2" style="border-top:1px solid #f1f5f9;font-size:0;line-height:0;">&nbsp;</td></tr>`;
    const pad = i === 0 ? "0 0 13px" : "13px 0";
    return `${divider}<tr><td style="padding:${pad};font-size:13px;color:#64748b;" valign="top">${r.label}</td><td style="padding:${pad};font-size:14px;font-weight:600;color:#0f172a;text-align:right;" valign="top">${r.value}</td></tr>`;
  }).join("");
  const commentsHtml = order.comments ? `<tr><td colspan="2" style="border-top:1px solid #f1f5f9;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td colspan="2" style="padding:13px 0 0;"><div style="font-size:13px;color:#64748b;margin-bottom:4px;">Comentarios</div><div style="font-size:14px;color:#475569;line-height:1.5;font-style:italic;">"${escape(order.comments)}"</div></td></tr>` : "";
  const productRows = order.products.map((p) => {
    const lineTotal = `${escape(ctx.currency_symbol)}${formatMoney(p.total)}`;
    const photoCell = p.photo ? `<img src="${escape(p.photo)}" alt="" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:8px;object-fit:cover;" />` : `<div style="width:40px;height:40px;border-radius:8px;background:#f1f5f9;"></div>`;
    const sizeLine = p.size ? `<p style="margin:3px 0 0;font-size:12px;color:#94a3b8;">Talla: <strong style="color:#475569;">${escape(p.size)}</strong></p>` : "";
    const description = p.description ? `<p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">${escape(p.description)}</p>` : "";
    return `\n        <tr>\n          <td width="48" valign="top" style="padding:14px 0;border-bottom:1px solid #f1f5f9;">${photoCell}</td>\n          <td valign="top" style="padding:14px 12px;border-bottom:1px solid #f1f5f9;">\n            <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;line-height:1.35;">${escape(p.name || "(sin nombre)")}</p>\n            ${sizeLine}${description}\n            <p style="margin:5px 0 0;font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums;">${p.quantity} × ${escape(ctx.currency_symbol)}${formatMoney(p.price)}</p>\n          </td>\n          <td valign="top" align="right" style="padding:14px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#0f172a;white-space:nowrap;font-variant-numeric:tabular-nums;">${lineTotal}</td>\n        </tr>`;
  }).join("");
  const bsRate = order.total_usd > 0 ? order.total_bs / order.total_usd : 0;
  const bsTotal = ctx.is_venezuela && order.total_bs && order.total_bs > 0 ? `<tr><td></td><td align="right" style="padding-top:2px;font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums;">Aprox. Bs. ${formatMoney(order.total_bs, 2)}${bsRate > 0 ? ` &nbsp;·&nbsp; Tasa ${formatMoney(bsRate, 2)}` : ""}</td></tr>` : "";
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f2f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f2f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8edf3;">
  <tr><td style="height:3px;background:${themeColor};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:20px 26px;border-bottom:1px solid #eef2f7;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
      <td valign="middle" width="42">${brandMark}</td>
      <td valign="middle" style="padding-left:12px;">
        <div style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.2;">${escape(ctx.tenant_name)}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Nuevo pedido recibido</div>
      </td>
      <td valign="middle" align="right">
        <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;">Pedido</div>
        <div style="font-size:15px;font-weight:800;color:${themeColor};">#${order.id}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 26px 4px;">
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${escape(formatDate(order.created_at))}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${detailHtml}
      ${commentsHtml}
    </table>
    <p style="margin:26px 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;">Productos · ${order.products.length}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${productRows}</table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:16px;">
      <tr>
        <td style="font-size:14px;font-weight:600;color:#475569;">Total</td>
        <td align="right" style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.01em;font-variant-numeric:tabular-nums;">${escape(ctx.currency_symbol)}${formatMoney(order.total_usd)}</td>
      </tr>
      ${bsTotal}
    </table>
    <div style="padding:26px 0 6px;">
      <a href="${escape(ordersUrl)}" style="display:inline-block;width:100%;box-sizing:border-box;background:${themeColor};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 0;border-radius:10px;text-align:center;">Ver el pedido</a>
    </div>
  </td></tr>
  <tr><td style="padding:18px 26px;text-align:center;background:#fbfcfe;border-top:1px solid #f1f5f9;">
    <p style="margin:0;font-size:11px;line-height:1.7;color:#94a3b8;">
      Recibiste este email porque administrás <strong style="color:#64748b;">${escape(ctx.tenant_name)}</strong>. Podés desactivar los avisos desde Perfil → Notificaciones.<br>
      <a href="https://catalogohoy.com" style="color:#94a3b8;text-decoration:none;">CatalogoHoy</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    `Nuevo pedido en ${ctx.tenant_name} — #${order.id}`,
    "",
    `Cliente: ${order.name}`,
    order.phone ? `Teléfono: ${order.phone}` : null,
    order.payment_method ? `Método de pago: ${order.payment_method}` : null,
    order.delivery_date ? `Entrega: ${order.delivery_date}` : null,
    order.comments ? `Comentarios: ${order.comments}` : null,
    "",
    "Productos:",
    ...order.products.map((p) => `  - ${p.name || "(sin nombre)"}${p.size ? ` (Talla ${p.size})` : ""} × ${p.quantity} = ${ctx.currency_symbol}${formatMoney(p.total)}`),
    "",
    `Total: ${ctx.currency_symbol}${formatMoney(order.total_usd)}`,
    "",
    `Ver pedidos: ${ordersUrl}`
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}
async function logDebug(admin, msg) {
  try {
    await admin.from("_debug_logs").insert({ fn_name: "send-order-notification", message: msg });
  } catch  { /* noop */ }
}
function hasEmailProvider() {
  return !!(Deno.env.get("AWS_SES_ACCESS_KEY_ID") || Deno.env.get("MAILER_SEND_API_KEY") || Deno.env.get("RESEND_API_KEY"));
}
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FromEmailAddress: `${fromName} <${fromEmail}>`,
      Destination: { ToAddresses: to },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            ...text ? { Text: { Data: text, Charset: "UTF-8" } } : {}
          }
        }
      },
      ConfigurationSetName: "catalogohoy-prod"
    })
  });
  if (!res.ok) return { ok: false, id: null, status: res.status, error: await res.text().catch(()=>"") };
  const j = await res.json().catch(()=>null);
  return { ok: true, id: j?.MessageId ?? null, status: res.status };
}
async function deliverEmail(opts) {
  const to = (Array.isArray(opts.to) ? opts.to : [ opts.to ]).filter((e)=>e && e.includes("@"));
  if (to.length === 0) return { ok: false, id: null, status: 0, error: "no recipients" };
  const fromName = opts.fromName ?? "CatalogoHoy";
  const fromEmail = opts.fromEmail ?? "noreply@catalogohoy.com";
  if (Deno.env.get("AWS_SES_ACCESS_KEY_ID") && Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")) {
    return await sendViaSes(to, fromName, fromEmail, opts.subject, opts.html, opts.text);
  }
  const msToken = Deno.env.get("MAILER_SEND_API_KEY");
  if (msToken) {
    const res = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({
        from: { email: fromEmail, name: fromName },
        to: to.map((email)=>({ email })),
        subject: opts.subject,
        html: opts.html,
        ...opts.text ? { text: opts.text } : {}
      })
    });
    const id = res.headers.get("x-message-id");
    if (!res.ok) return { ok: false, id, status: res.status, error: await res.text().catch(()=>"") };
    return { ok: true, id, status: res.status };
  }
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject: opts.subject,
        html: opts.html,
        ...opts.text ? { text: opts.text } : {}
      })
    });
    if (!res.ok) return { ok: false, id: null, status: res.status, error: await res.text().catch(()=>"") };
    const j = await res.json().catch(()=>null);
    return { ok: true, id: j?.id ?? null, status: res.status };
  }
  return { ok: false, id: null, status: 0, error: "No email provider (MAILER_SEND_API_KEY / RESEND_API_KEY)" };
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  if (req.headers.get("x-webhook-secret") !== INTERNAL_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceKey);
  if (!hasEmailProvider()) {
    await logDebug(admin, "No email provider (MAILER_SEND_API_KEY / RESEND_API_KEY)");
    return new Response(JSON.stringify({ error: "No email provider configured" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  let body;
  try {
    body = await req.json();
  } catch  {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const orderId = body.orderId;
  if (!orderId) {
    return new Response(JSON.stringify({ error: "orderId is required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const { data: order, error: orderErr } = await admin.from("orders").select("id, tenant_id, name, phone, comments, status, products, total_usd, total_bs, payment_method, delivery_date, created_at").eq("id", orderId).single();
  if (orderErr || !order) {
    await logDebug(admin, `Order ${orderId} not found: ${orderErr?.message ?? "null"}`);
    return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const { data: tenant, error: tenantErr } = await admin.from("tenants").select("id, name, slug, country_code, custom_domain").eq("id", order.tenant_id).single();
  if (tenantErr || !tenant) {
    await logDebug(admin, `Tenant ${order.tenant_id} not found: ${tenantErr?.message ?? "null"}`);
    return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const { data: config } = await admin.from("tenant_ecommerce_config").select("logo, theme_color, currency_symbol").eq("tenant_id", tenant.id).maybeSingle();
  // El opt-out de estos avisos ahora es POR USUARIO (users.notify_new_orders_email),
  // ya no un interruptor de todo el catálogo. Cada destinatario se filtra abajo.
  const { data: ownerLinks } = await admin.from("users_tenants").select("users(email)").eq("tenant_id", tenant.id).eq("role", "owner");
  const ownerEmails = (ownerLinks ?? []).map((row)=>row.users?.email).filter((e)=>!!e && e.includes("@"));
  const { data: tenantTeams } = await admin.from("teams").select("id").eq("tenant_id", tenant.id);
  const teamIds = (tenantTeams ?? []).map((t)=>t.id);
  const memberEmails = [];
  if (teamIds.length > 0) {
    const { data: memberRows } = await admin.from("team_members").select("id, invited_email, status, users(email), team_member_permissions(module, action)").in("team_id", teamIds).eq("status", "accepted");
    for (const m of memberRows ?? []){
      const perms = m.team_member_permissions ?? [];
      const hasOrdersView = perms.some((p)=>p.module === "ordenes" && p.action === "view");
      if (!hasOrdersView) continue;
      const email = m.users?.email ?? m.invited_email;
      if (email && email.includes("@")) memberEmails.push(email);
    }
  }
  const recipientEmails = Array.from(new Set([ ...ownerEmails, ...memberEmails ].map((e)=>e.toLowerCase())));
  if (recipientEmails.length === 0) {
    await logDebug(admin, `Order ${orderId}: no recipients for tenant ${tenant.id}`);
    return new Response(JSON.stringify({ skipped: "no recipients" }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }
  // Preferencia por usuario (nivel cuenta): quien apagó "Avisos de pedidos por
  // email" en su Perfil no recibe. Invitados sin cuenta reciben por defecto.
  const { data: optOutRows } = await admin.from("users").select("email").eq("notify_new_orders_email", false);
  const optedOut = new Set((optOutRows ?? []).map((r)=>String(r.email ?? "").toLowerCase()));
  const finalRecipients = recipientEmails.filter((e)=>!optedOut.has(e));
  if (finalRecipients.length === 0) {
    await logDebug(admin, `Order ${orderId}: all recipients opted out for tenant ${tenant.id}`);
    return new Response(JSON.stringify({ skipped: "all recipients opted out" }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const ctx = {
    tenant_name: tenant.name,
    slug: tenant.slug,
    custom_domain: tenant.custom_domain,
    logo: config?.logo ?? null,
    theme_color: config?.theme_color ?? "#10b981",
    currency_symbol: config?.currency_symbol ?? "$",
    is_venezuela: tenant.country_code === "VE",
    recipient_emails: finalRecipients
  };
  const { subject, html, text } = renderEmail(order, ctx);
  const emailRes = await deliverEmail({ to: finalRecipients, subject, html, text, fromName: "CatálogoHoy" });
  if (!emailRes.ok) {
    await logDebug(admin, `Email ${emailRes.status} for order ${orderId}: ${emailRes.error ?? ""}`);
    return new Response(JSON.stringify({ error: `Email error: ${emailRes.status}`, details: emailRes.error }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  await logDebug(admin, `Order ${orderId} → ${finalRecipients.join(",")} (email id ${emailRes.id ?? "?"})`);
  return new Response(JSON.stringify({ success: true, recipients: finalRecipients, emailId: emailRes.id }), { headers: { ...CORS, "Content-Type": "application/json" } });
});

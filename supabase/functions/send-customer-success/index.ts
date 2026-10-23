import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";
// ============================================================================
// send-customer-success (CAT-48) — motor de disparo de plantillas de ciclo de
// vida (CatalogoHoy → comerciante). Corre por cron.
//
// Primera condición: order_pending_reminder — pedidos pending 2–30 días sin
// recordatorio previo (candidatos vía RPC customer_success_order_pending_
// candidates). Canales:
//   - WhatsApp: por pedido (template aprobado con botón URL a cada orden,
//     best-effort si hay número).
//   - Email (AWS SES, fallback Resend): UN solo correo por dueño agrupando
//     TODOS sus pedidos pendientes — nunca 1 email por pedido.
// Idempotencia: 1 fila por PEDIDO en customer_success_sends (event_key único
// `order_pending:<order_id>`), así los pedidos nuevos del día siguiente se
// recuerdan sin re-spamear los ya avisados.
//
// Auth del cron: x-webhook-secret contra el secret `customer_success_webhook_
// secret` en Vault (o env CUSTOMER_SUCCESS_WEBHOOK_SECRET como override).
//
// Params opcionales (body JSON) para el rollout controlado:
//   { onlyOrderId?: number, limit?: number, record?: boolean, sendEmail?: boolean, dryRun?: boolean }
//   - onlyOrderId: procesa solo esa orden (test en demo).
//   - limit: procesa solo los N candidatos más recientes (rollout por sublotes).
//   - record=false: no marca idempotencia (para re-testear).
//   - dryRun=true: no envía nada, solo devuelve los candidatos.
// ============================================================================
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret"
};
function firstNameOf(name, fallback) {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n || fallback;
}
function daysLabel(days) {
  const d = Math.max(1, days);
  return d === 1 ? "1 día" : `${d} días`;
}
function escapeHtml(input) {
  if (input == null) return "";
  return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// UN solo correo por dueño, con TODOS sus pedidos pendientes agrupados.
// `group` = array de candidatos que comparten el mismo owner_email.
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
function renderPendingEmail(group) {
  // Más urgente (más días pendiente) primero.
  const orders = [
    ...group
  ].sort((a, b)=>(b.days_pending ?? 0) - (a.days_pending ?? 0));
  const first = firstNameOf(orders[0].owner_name, orders[0].catalog_name);
  const n = orders.length;
  const plural = n > 1;
  const catalogs = Array.from(new Set(orders.map((o)=>o.catalog_name).filter(Boolean)));
  const oneCatalog = catalogs.length === 1;
  const catalogLabel = oneCatalog ? catalogs[0] : "tus catálogos";
  const subject = plural ? `Tenés ${n} pedidos pendientes — CatalogoHoy` : "Tenés un pedido pendiente — CatalogoHoy";
  const headline = plural ? `Tenés ${n} pedidos esperando confirmación.` : "Tenés un pedido esperando confirmación.";
  const subline = plural ? "Cada cliente que espera es una venta a punto de cerrarse. Confirmalos antes de que se enfríen." : "Un cliente esperando es una venta a punto de cerrarse. Confirmalo antes de que se enfríe.";
  // Una tarjeta por pedido: producto + meta + botón "Ver →" a esa orden.
  const cards = orders.map((c)=>{
    const orderUrl = `https://catalogohoy.com/o/${c.order_id}`;
    const timePending = daysLabel(c.days_pending);
    // El catálogo en la meta solo si el dueño tiene más de uno (si no, es ruido).
    const meta = oneCatalog ? `Pendiente hace ${escapeHtml(timePending)}` : `${escapeHtml(c.catalog_name)} · Pendiente hace ${escapeHtml(timePending)}`;
    // Thumbnail del primer producto (placeholder gris si la orden no tiene foto).
    const thumb = c.photo ? `<img src="${escapeHtml(c.photo)}" alt="" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:9px;object-fit:cover;" />` : `<div style="width:44px;height:44px;border-radius:9px;background:#eef2f7;"></div>`;
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f7ff;border-radius:8px;margin:0 0 10px;">
        <tr><td style="padding:12px 14px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td width="44" valign="middle" style="padding-right:12px;">${thumb}</td>
            <td valign="middle">
              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#16367f;line-height:1.35;">${escapeHtml(c.product_name || "Pedido")}</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">${meta}</p>
            </td>
            <td valign="middle" align="right" style="padding-left:12px;white-space:nowrap;">
              <a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:#3e7bfa;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;padding:8px 14px;border-radius:8px;">Ver&nbsp;→</a>
            </td>
          </tr></table>
        </td></tr>
      </table>`;
  }).join("");
  const html = brandEmail({
    title: headline,
    width: 520,
    bodyHtml: `<p style="margin:0 0 10px;">Hola ${escapeHtml(first)},</p>
    <p style="margin:0 0 20px;">${escapeHtml(subline)}</p>
    ${cards}`,
    footer: `Recibiste este email porque ${plural ? "tienes pedidos pendientes" : "tienes un pedido pendiente"} en <strong>${escapeHtml(catalogLabel)}</strong>.`
  });
  const text = [
    `Hola ${first},`,
    "",
    plural ? `Tenés ${n} pedidos pendientes de confirmación:` : "Tenés un pedido pendiente de confirmación:",
    "",
    ...orders.map((c)=>`- ${c.product_name || "Pedido"}${oneCatalog ? "" : ` (${c.catalog_name})`} — pendiente hace ${daysLabel(c.days_pending)}: https://catalogohoy.com/o/${c.order_id}`),
    "",
    plural ? "Confirmalos antes de que se enfríen." : "Confirmalo antes de que se enfríe."
  ].join("\n");
  return {
    subject,
    html,
    text
  };
}
// --- Email (MailerSend con fallback a Resend) ---------------------------------
// Usa MailerSend si MAILER_SEND_API_KEY está seteado; si no, cae a Resend con
// RESEND_API_KEY. El switch es por presencia del token: se deploya sin romper
// nada y se flipea a MailerSend seteando el secret cuando el dominio esté
// verificado. MailerSend responde 202 y el id viene en el header x-message-id.
function hasEmailProvider() {
  return !!(Deno.env.get("AWS_SES_ACCESS_KEY_ID") || Deno.env.get("MAILER_SEND_API_KEY") || Deno.env.get("RESEND_API_KEY"));
}
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
// AWS SES (v2 SendEmail, SigV4 con aws4fetch). Proveedor principal: se activa por
// presencia de AWS_SES_ACCESS_KEY_ID (prioridad sobre MailerSend/Resend).
async function sendViaSes(to, fromName, fromEmail, subject, html, text) {
  to = to.filter((e) => !isUndeliverableEmail(e));
  if (to.length === 0) return { ok: false, id: null, status: 0, error: "undeliverable recipient" };
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
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  // Auth: env override, Vault como fuente normal (repo público → nada hardcodeado).
  let expectedSecret = Deno.env.get("CUSTOMER_SUCCESS_WEBHOOK_SECRET") ?? null;
  if (!expectedSecret) {
    const { data } = await admin.rpc("internal_get_secret", {
      p_name: "customer_success_webhook_secret"
    });
    expectedSecret = data ?? null;
  }
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
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
  let opts = {};
  try {
    opts = req.method === "POST" ? await req.json() : {};
  } catch  {
    opts = {};
  }
  const record = opts.record !== false;
  const sendEmail = opts.sendEmail !== false;
  const waSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  const emailReady = hasEmailProvider();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // --- Condición 1: order_pending_reminder ---
  const { data: rows, error } = await admin.rpc("customer_success_order_pending_candidates");
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...CORS,
        "Content-Type": "application/json"
      }
    });
  }
  let candidates = rows ?? [];
  // Más recientes primero (order_id como proxy de recencia) para los sublotes.
  candidates.sort((a, b)=>b.order_id - a.order_id);
  if (opts.onlyOrderId) {
    candidates = candidates.filter((c)=>c.order_id === opts.onlyOrderId);
  }
  if (opts.limit && opts.limit > 0) {
    candidates = candidates.slice(0, opts.limit);
  }
  if (opts.dryRun) {
    return new Response(JSON.stringify({
      dryRun: true,
      count: candidates.length,
      candidates
    }), {
      headers: {
        ...CORS,
        "Content-Type": "application/json"
      }
    });
  }
  // Foto del primer producto de cada orden (1 query batch) para el thumbnail
  // del email. Best-effort: si falla, el email cae al placeholder gris.
  if (sendEmail && candidates.length) {
    try {
      const ids = candidates.map((c)=>c.order_id);
      const { data: ordProducts } = await admin.from("orders").select("id, products").in("id", ids);
      const photoById = new Map();
      for (const o of ordProducts ?? []){
        const p = Array.isArray(o.products) ? o.products[0] : null;
        const photo = p && typeof p.photo === "string" && p.photo.startsWith("http") ? p.photo : null;
        photoById.set(o.id, photo);
      }
      for (const c of candidates)c.photo = photoById.get(c.order_id) ?? null;
    } catch  {
    /* noop: sin foto → placeholder */ }
  }
  // Estado por pedido: WhatsApp se manda por-pedido (template aprobado con botón
  // URL a cada orden), pero el EMAIL se agrupa en 1 solo correo por dueño.
  const perOrder = new Map();
  for (const c of candidates){
    perOrder.set(c.order_id, {
      c,
      waOk: false,
      emailOk: false
    });
  }
  // --- WhatsApp: por pedido (best-effort: solo si hay número resolvible + secret) ---
  if (waSecret) {
    for (const entry of perOrder.values()){
      const c = entry.c;
      if (!c.wa_recipient) continue;
      const first = firstNameOf(c.owner_name, c.catalog_name);
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": waSecret
          },
          body: JSON.stringify({
            tenantId: c.tenant_id,
            to: c.wa_recipient,
            templateType: "order_pending_reminder",
            variables: [
              first,
              c.product_name,
              c.catalog_name,
              daysLabel(c.days_pending)
            ],
            urlButtonParam: String(c.order_id)
          })
        });
        const j = await res.json().catch(()=>null);
        entry.waOk = res.ok && j?.success === true && !j?.skipped;
      } catch  {
        entry.waOk = false;
      }
    }
  }
  // --- Email: UN correo por dueño con TODOS sus pedidos pendientes ---
  let emailsSent = 0;
  if (sendEmail && emailReady) {
    const groups = new Map();
    for (const c of candidates){
      if (!c.owner_email || !c.owner_email.includes("@")) continue;
      const key = c.owner_email.toLowerCase();
      const g = groups.get(key);
      if (g) g.push(c);
      else groups.set(key, [
        c
      ]);
    }
    for (const [email, group] of groups){
      let ok = false;
      try {
        const { subject, html, text } = renderPendingEmail(group);
        const r = await deliverEmail({
          to: email,
          subject,
          html,
          text
        });
        ok = r.ok;
      } catch  {
        ok = false;
      }
      if (ok) {
        emailsSent++;
        for (const c of group)perOrder.get(c.order_id).emailOk = true;
      }
    }
  }
  // --- Idempotencia: 1 fila por pedido si algún canal salió ---
  const summary = [];
  for (const entry of perOrder.values()){
    const { c, waOk, emailOk } = entry;
    let recorded = false;
    if (record && (waOk || emailOk)) {
      const channel = waOk && emailOk ? "both" : waOk ? "whatsapp" : "email";
      const { error: insErr } = await admin.from("customer_success_sends").insert({
        tenant_id: c.tenant_id,
        event_key: `order_pending:${c.order_id}`,
        channel,
        recipient: c.wa_recipient ?? c.owner_email
      });
      recorded = !insErr;
    }
    summary.push({
      orderId: c.order_id,
      tenantId: c.tenant_id,
      whatsapp: waOk,
      email: emailOk,
      recorded
    });
  }
  return new Response(JSON.stringify({
    condition: "order_pending_reminder",
    orders: summary.length,
    emails: emailsSent,
    summary
  }), {
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
});

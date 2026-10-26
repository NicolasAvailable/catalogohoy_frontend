import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

// --- Layout de marca de emails ----------------------------------------------
// Mismo diseño que las plantillas de Supabase Auth (reset de contraseña, etc.):
// fondo #eaf1ff, card blanca con radio 12px, logo, título #16367f, texto
// #383838 en Arial y botón #3e7bfa con radio 8px. Copia idéntica en cada
// función que manda email: si cambiás algo acá, cambialo en todas.
const BRAND_LOGO_URL = "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/catalogohoy-logo.png";
const BRAND_BLUE = "#3e7bfa";
type BrandButton = { label: string; url: string; secondary?: boolean };
type BrandEmailOpts = { title: string; subtitle?: string; bodyHtml: string; buttons?: BrandButton[]; note?: string; footer?: string; width?: number };
function brandEsc(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// Botón principal (azul lleno) o secundario (borde azul).
function brandButton(b: BrandButton): string {
  const style = b.secondary
    ? `background-color:#ffffff;color:${BRAND_BLUE};border:2px solid ${BRAND_BLUE};padding:12px 24px;`
    : `background-color:${BRAND_BLUE};color:#ffffff;padding:14px 26px;`;
  return `<a href="${brandEsc(b.url)}" style="${style}text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;margin:4px;">${brandEsc(b.label)}</a>`;
}
// opts: { title, subtitle?, bodyHtml, buttons?: [{label,url,secondary?}], note?, footer?, width? }
function brandEmail(opts: BrandEmailOpts): string {
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
async function sendViaSes(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; status: number; error?: string }> {
  if (isUndeliverableEmail(to)) return { ok: false, status: 0, error: "undeliverable recipient" };
  if (!Deno.env.get("AWS_SES_ACCESS_KEY_ID") || !Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")) {
    return { ok: false, status: 0, error: "no SES credentials" };
  }
  const region = Deno.env.get("AWS_SES_REGION") ?? "sa-east-1";
  const aws = new AwsClient({
    accessKeyId: Deno.env.get("AWS_SES_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")!,
    region,
    service: "ses",
  });
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FromEmailAddress: "CatalogoHoy <noreply@catalogohoy.com>",
      Destination: { ToAddresses: [to] },
      Content: { Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Html: { Data: html, Charset: "UTF-8" }, Text: { Data: text, Charset: "UTF-8" } },
      } },
      ConfigurationSetName: "catalogohoy-prod",
    }),
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(() => "") };
  return { ok: true, status: res.status };
}

const INVITE_SUBJECT_PREFIX = "Te invitaron a colaborar en ";

// Invitación de equipo que rebotó de forma permanente (el correo no existe):
// la marca en team_members (bounced_at) para que Equipo la muestre como
// fallida y le avisa por email a quien invitó. Encuentra la invitación por el
// tag team_member_id que pone invite-team-member; las invitaciones viejas (sin
// tags) se buscan por asunto + correo. Idempotente: si ya tiene bounced_at
// (SNS reintenta) no hace nada.
async function handleTeamInviteBounce(
  admin: SupabaseClient,
  tags: Record<string, string[]> | null,
  subject: string | null,
  recipient: string | null,
  diagnostic: string | null,
): Promise<void> {
  const isInvite = tags?.type?.includes("team_invite") ||
    (subject ?? "").startsWith(INVITE_SUBJECT_PREFIX);
  if (!isInvite || !recipient) return;

  const select = "id, team_id, invited_email, invited_by, bounced_at, status";
  const taggedId = Number(tags?.team_member_id?.[0]);
  let member: any = null;
  if (Number.isFinite(taggedId) && taggedId > 0) {
    const { data } = await admin.from("team_members").select(select).eq("id", taggedId).maybeSingle();
    member = data;
  }
  if (!member) {
    const { data } = await admin.from("team_members").select(select)
      .eq("invited_email", recipient.toLowerCase().trim())
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    member = data;
  }
  if (!member || member.bounced_at || member.status !== "pending") return;

  const { data: marked } = await admin.from("team_members")
    .update({ bounced_at: new Date().toISOString(), bounce_reason: diagnostic?.slice(0, 500) ?? null })
    .eq("id", member.id)
    .is("bounced_at", null)
    .select("id");
  if (!marked?.length) return;

  const { data: team } = await admin.from("teams").select("tenant_id, tenants(name, slug)").eq("id", member.team_id).maybeSingle();
  const tenantId = (team as any)?.tenant_id;
  const tenantName: string = (team as any)?.tenants?.name ?? "tu catálogo";
  const slug: string | null = (team as any)?.tenants?.slug ?? null;
  const teamUrl = slug ? `https://${slug}.catalogohoy.com/admin/teams` : "https://catalogohoy.com/admin/teams";

  // Quien invitó; si la invitación es vieja (sin invited_by), los dueños.
  let inviters: Array<{ email: string | null; name: string | null }> = [];
  if (member.invited_by) {
    const { data } = await admin.from("users").select("email, name").eq("id", member.invited_by).maybeSingle();
    if (data) inviters = [data];
  }
  if (!inviters.length && tenantId) {
    const { data } = await admin.from("users_tenants").select("users(email, name)")
      .eq("tenant_id", tenantId).eq("role", "owner");
    inviters = (data ?? []).map((r: any) => r.users).filter(Boolean);
  }

  for (const inviter of inviters) {
    if (!inviter.email) continue;
    const first = (inviter.name ?? "").trim().split(/\s+/)[0];
    const hello = first ? `¡Hola ${brandEsc(first)}!` : "¡Hola!";
    const html = brandEmail({
      title: "No pudimos entregar tu invitación",
      bodyHtml: `<p style="margin:0 0 12px;">${hello}</p>
<p style="margin:0 0 12px;">Invitaste a <strong>${brandEsc(member.invited_email)}</strong> a colaborar en <strong>${brandEsc(tenantName)}</strong>, pero el correo rebotó: esa dirección no existe o no recibe mensajes.</p>
<p style="margin:0;">Revisa que esté bien escrita, cancela la invitación en <strong>Equipo</strong> y vuelve a invitar con el correo correcto.</p>`,
      buttons: [{ label: "Ir a Equipo", url: teamUrl }],
      note: "Si tienes alguna duda, responde a este correo o escríbenos por WhatsApp. Estamos para ayudarte.",
    });
    const text = `${first ? `¡Hola ${first}!` : "¡Hola!"}

Invitaste a ${member.invited_email} a colaborar en ${tenantName}, pero el correo rebotó: esa dirección no existe o no recibe mensajes.

Revisa que esté bien escrita, cancela la invitación en Equipo y vuelve a invitar con el correo correcto: ${teamUrl}

© ${new Date().getFullYear()} CatalogoHoy`;
    const r = await sendViaSes(inviter.email, `No pudimos entregar tu invitación a ${member.invited_email}`, html, text);
    if (!r.ok) console.error("invite bounce notice failed:", r.status, r.error);
  }
}

// Webhook de eventos de Amazon SES (via SNS). Recibe Send/Delivery/Bounce/
// Complaint/Open/Click/Reject/DeliveryDelay del config set catalogohoy-prod y
// los persiste en ses_email_events (RPC ingest_ses_event, service role).
// Auth: ?token=<secreto> (SNS postea a la URL exacta suscrita) + TopicArn.
Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== Deno.env.get("SES_EVENTS_WEBHOOK_TOKEN")) {
      return new Response("forbidden", { status: 403 });
    }

    const raw = await req.text();
    let sns: any;
    try { sns = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

    const type = sns.Type ?? req.headers.get("x-amz-sns-message-type") ?? "";

    // Confirmación de suscripción SNS
    if (type === "SubscriptionConfirmation") {
      if (sns.SubscribeURL) await fetch(sns.SubscribeURL);
      return new Response("subscription confirmed", { status: 200 });
    }
    if (type !== "Notification") return new Response("ignored", { status: 200 });

    const expectedTopic = Deno.env.get("SES_EVENTS_TOPIC_ARN");
    if (expectedTopic && sns.TopicArn && sns.TopicArn !== expectedTopic) {
      return new Response("wrong topic", { status: 403 });
    }

    let ev: any;
    try { ev = JSON.parse(sns.Message); } catch { return new Response("bad message", { status: 200 }); }

    const eventType: string = ev.eventType ?? ev.notificationType ?? "";
    const mail = ev.mail ?? {};
    const messageId: string | undefined = mail.messageId;
    if (!messageId) return new Response("no messageId", { status: 200 });

    const destination: string[] = Array.isArray(mail.destination) ? mail.destination : [];
    const recipient = destination[0] ?? null;
    const subject = mail.commonHeaders?.subject ?? null;
    const from = mail.source ?? mail.commonHeaders?.from?.[0] ?? null;

    const tsFor = (t: string): string | undefined => {
      switch (t) {
        case "Delivery": return ev.delivery?.timestamp;
        case "Bounce": return ev.bounce?.timestamp;
        case "Complaint": return ev.complaint?.timestamp;
        case "Open": return ev.open?.timestamp;
        case "Click": return ev.click?.timestamp;
        case "DeliveryDelay": return ev.deliveryDelay?.timestamp;
        default: return mail.timestamp;
      }
    };
    const ts = tsFor(eventType) ?? mail.timestamp ?? null;

    let bounceType: string | null = null;
    let bounceSubType: string | null = null;
    let diagnostic: string | null = null;
    if (eventType === "Bounce") {
      bounceType = ev.bounce?.bounceType ?? null;
      bounceSubType = ev.bounce?.bounceSubType ?? null;
      diagnostic = ev.bounce?.bouncedRecipients?.[0]?.diagnosticCode ?? null;
    } else if (eventType === "Complaint") {
      diagnostic = ev.complaint?.complaintFeedbackType ?? null;
    } else if (eventType === "Reject") {
      diagnostic = ev.reject?.reason ?? null;
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await admin.rpc("ingest_ses_event", {
      p_message_id: messageId,
      p_recipient: recipient,
      p_recipients: destination,
      p_subject: subject,
      p_from: from,
      p_event: eventType,
      p_ts: ts,
      p_tags: mail.tags ?? null,
      p_bounce_type: bounceType,
      p_bounce_subtype: bounceSubType,
      p_diagnostic: diagnostic,
    });
    if (error) {
      console.error("ingest_ses_event error:", error.message);
      return new Response("db error", { status: 500 });
    }

    // Invitación de equipo con correo inexistente → avisar a quien invitó.
    if (eventType === "Bounce" && bounceType === "Permanent") {
      try {
        await handleTeamInviteBounce(admin, mail.tags ?? null, subject, recipient, diagnostic);
      } catch (e) {
        console.error("team invite bounce failed:", e instanceof Error ? e.message : String(e));
      }
    }

    // Fallos de entrega → canal de Slack de errores (best-effort). Cubre a
    // TODOS los senders de email en un solo punto: si SES no pudo entregar
    // (Bounce/Reject) o el destinatario marcó spam (Complaint), avisamos.
    if (["Bounce", "Complaint", "Reject"].includes(eventType)) {
      try {
        let webhook = Deno.env.get("SLACK_IMPORT_EVENTS_WEBHOOK") ?? null;
        if (!webhook) {
          const { data } = await admin.rpc("internal_get_secret", {
            p_name: "slack_import_events_webhook",
          });
          webhook = (data as string | null) ?? null;
        }
        if (webhook) {
          const detailParts = [
            bounceType ? `${bounceType}/${bounceSubType ?? ""}` : null,
            diagnostic,
          ].filter(Boolean);
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: `📧 Email ${eventType === "Complaint" ? "marcado como spam" : "no entregado"} (${eventType})`,
                    emoji: true,
                  },
                },
                {
                  type: "section",
                  fields: [
                    { type: "mrkdwn", text: `*Para:*\n${recipient ?? "—"}` },
                    { type: "mrkdwn", text: `*Asunto:*\n${subject ?? "—"}` },
                  ],
                },
                ...(detailParts.length
                  ? [{
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: `*Detalle:*\n${detailParts.join(" — ").slice(0, 500)}`,
                    },
                  }]
                  : []),
                {
                  type: "context",
                  elements: [{
                    type: "mrkdwn",
                    text: `ses-events · ${ts ?? new Date().toISOString()}`,
                  }],
                },
              ],
            }),
          });
        }
      } catch (e) {
        console.error("slack notify failed:", e instanceof Error ? e.message : String(e));
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("ses-events error:", e instanceof Error ? e.message : String(e));
    return new Response("error", { status: 500 });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";
import postgres from "npm:postgres@3";

// =============================================================================
// send-announcement — correo de ANUNCIO puntual (fuera del ciclo semanal/mensual
// de `send-newsletter`). Campaña actual: nuevo editor de catálogo (CAT-103).
//
// POST con sesión del admin interno (_assert_internal_admin). Body { action }:
//   audience → cuántos lo recibirían (sin enviar).
//   test     → { email? } manda una muestra (por defecto al admin). No registra.
//   send     → { limit? } manda un lote a quien aún no lo recibió. Repetir hasta
//              remaining = 0.
//
// Audiencia: dueños/miembros de tienda con ACTIVIDAD en los últimos 150 días
// (inicio de sesión, producto creado u orden recibida), sin baja de novedades,
// sin rebotes permanentes ni quejas, y que aún no recibieron esta campaña
// (marketing_sends). La baja usa el mismo link/token que `send-newsletter`.
// =============================================================================

const CAMPAIGN = "announce_catalog_editor_2026_11";
const SUBJECT = "Ya puedes personalizar el diseño de tu catálogo";
const PREHEADER = "Cambia colores, fondo, botones y letra, y mira cómo queda antes de guardar.";
const ACTIVE_DAYS = 150;
const FROM = "CatalogoHoy <novedades@catalogohoy.com>";
const REPLY_TO = "nicolas@catalogohoy.com";
const ADMIN_EMAIL = "nicolas@catalogohoy.com";
const UNSUB_FN_URL = "https://api.catalogohoy.com/functions/v1/send-newsletter";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const HTML = "<!DOCTYPE html>\n<html lang=\"es\" style=\"margin:0;padding:0;background:#eaf1ff;\">\n<head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" /><meta name=\"color-scheme\" content=\"light only\" /><title>Ahora tu catálogo se ve como tú quieras</title></head>\n<body style=\"font-family:Arial,Helvetica,sans-serif;background-color:#eaf1ff;margin:0;padding:0;\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#eaf1ff;padding:40px 12px;\"><tr><td align=\"center\">\n<table width=\"560\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:100%;background:#ffffff;border-radius:12px;padding:40px 30px;box-shadow:0 4px 10px rgba(0,0,0,0.06);font-family:Arial,Helvetica,sans-serif;\">\n<tr><td align=\"center\" style=\"padding-bottom:20px;\"><img src=\"https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/catalogohoy-logo.png\" alt=\"CatalogoHoy\" width=\"90\" style=\"display:block;\" /></td></tr>\n<tr><td style=\"font-size:22px;font-weight:bold;color:#16367f;text-align:center;padding-bottom:6px;\">Ahora tu catálogo se ve como tú quieras</td></tr>\n<tr><td style=\"font-size:13px;color:#646464;text-align:center;padding-bottom:20px;\">Nuevo editor de catálogo con 12 temas</td></tr>\n<tr><td style=\"font-size:15px;color:#383838;text-align:left;line-height:1.6;padding-bottom:25px;\">\n<p style=\"margin:0 0 14px;\">{{saludo}}</p>\n<p style=\"margin:0 0 14px;\">Renovamos por completo la sección <strong>Editar catálogo</strong>. Ahora puedes cambiar el tema, los colores, el fondo, los botones y la letra de tu catálogo, y ver cómo queda en vivo antes de guardar.</p>\n<img src=\"https://cdn.catalogohoy.com/newsletter/1794607269602-anuncio-editor-catalogos-ejemplo.jpg\" alt=\"Dos catálogos con diseños distintos: uno verde con letra clásica y otro blanco con botones morados\" width=\"500\" style=\"display:block;width:100%;max-width:500px;height:auto;border-radius:10px;margin:6px 0 4px;border:1px solid #e6ecf8;\" />\n<p style=\"margin:4px 0 0;font-size:12px;color:#8a8a8a;text-align:center;\">Dos tiendas, la misma plataforma, dos estilos distintos.</p>\n\n<p style=\"margin:26px 0 4px;font-size:18px;font-weight:bold;color:#16367f;\">🎨 Lo que puedes hacer</p>\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">\n<tr><td style=\"padding:10px 0;border-bottom:1px solid #eef2fb;\">\n<p style=\"margin:0 0 2px;font-size:16px;font-weight:bold;color:#16367f;\">12 temas listos para usar</p>\n<p style=\"margin:0;font-size:14px;color:#4a4a4a;line-height:1.5;\">Claros, oscuros, con degradados o de estilo bloque. Eliges uno y tu catálogo cambia completo con un toque.</p>\n</td></tr>\n<tr><td style=\"padding:10px 0;border-bottom:1px solid #eef2fb;\">\n<p style=\"margin:0 0 2px;font-size:16px;font-weight:bold;color:#16367f;\">Colores, fondo y letra a tu gusto</p>\n<p style=\"margin:0;font-size:14px;color:#4a4a4a;line-height:1.5;\">Pon los colores de tu marca, usa una foto o un video de fondo y escoge entre 6 tipos de letra.</p>\n</td></tr>\n<tr><td style=\"padding:10px 0;border-bottom:1px solid #eef2fb;\">\n<p style=\"margin:0 0 2px;font-size:16px;font-weight:bold;color:#16367f;\">Botones con tu propio texto</p>\n<p style=\"margin:0;font-size:14px;color:#4a4a4a;line-height:1.5;\">Cambia la forma y el estilo del botón, y escribe lo que quieras en vez de \"Agregar\": \"Comprar\", \"Lo quiero\", \"Pedir\" o tu propia frase.</p>\n</td></tr>\n<tr><td style=\"padding:10px 0;border-bottom:1px solid #eef2fb;\">\n<p style=\"margin:0 0 2px;font-size:16px;font-weight:bold;color:#16367f;\">Productos destacados y categorías a tu manera</p>\n<p style=\"margin:0;font-size:14px;color:#4a4a4a;line-height:1.5;\">Muestra tus mejores productos arriba, pon el catálogo en cuadrícula o en lista y elige cómo se ven tus categorías.</p>\n</td></tr>\n<tr><td style=\"padding:10px 0;border-bottom:1px solid #eef2fb;\">\n<p style=\"margin:0 0 2px;font-size:16px;font-weight:bold;color:#16367f;\">Vista previa en vivo</p>\n<p style=\"margin:0;font-size:14px;color:#4a4a4a;line-height:1.5;\">Cada cambio se ve al instante en un teléfono o en una computadora de muestra. Tus clientes solo ven el diseño nuevo cuando le das a Guardar.</p>\n<img src=\"https://cdn.catalogohoy.com/newsletter/1794607271183-anuncio-editor-editor-temas.jpg\" alt=\"El editor de catálogo con la galería de temas y la vista previa en un teléfono\" width=\"500\" style=\"display:block;width:100%;max-width:500px;height:auto;border-radius:10px;margin:10px 0 4px;border:1px solid #e6ecf8;\" />\n</td></tr>\n</table>\n\n<p style=\"margin:26px 0 0;padding:12px 14px;background:#f4f7ff;border-radius:8px;font-size:14px;line-height:1.5;\"><strong>¿Cómo lo pruebo?</strong> Entra a tu panel, ve a <strong>Mi catálogo → Editar</strong> y abre la sección <strong>Tema</strong>. El tema Claro está disponible en todos los planes. Los demás temas y opciones los puedes probar libremente, y se guardan desde el plan Básico.</p>\n<p style=\"margin:14px 0 0;padding:12px 14px;background:#fff8e6;border:1px solid #f6e2a8;border-radius:8px;font-size:14px;line-height:1.5;color:#5c4a12;\"><strong>¿Dónde está disponible?</strong> Ya puedes usarlo desde la <strong>web</strong> y desde la <strong>app de Android</strong> (actualízala en <a href=\"https://play.google.com/store/apps/details?id=com.catalogohoy.app\" style=\"color:#3e7bfa;\">Google Play</a>). En <strong>iPhone</strong> llegará en unos días: cuando esté lista, solo tendrás que actualizar la app en el App Store. Mientras tanto, en iPhone puedes entrar desde el navegador.</p>\n</td></tr>\n<tr><td align=\"center\" style=\"padding-bottom:30px;\"><a href=\"https://auth.catalogohoy.com\" style=\"background-color:#3e7bfa;color:#ffffff;padding:14px 26px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;margin:4px;\">Personalizar mi catálogo</a></td></tr>\n<tr><td style=\"font-size:12px;color:#a6a6a6;text-align:center;padding-top:25px;line-height:1.6;\">Recibes este correo porque tienes una tienda en CatalogoHoy. <a href=\"{{baja}}\" style=\"color:#a6a6a6;\">Dejar de recibir novedades</a><br />© 2026 CatalogoHoy — Todos los derechos reservados.</td></tr>\n</table>\n</td></tr></table>\n</body>\n</html>\n";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Mismo token que send-newsletter (HMAC del correo) → el link de baja funciona
// contra su endpoint y respeta newsletter_unsubscribes.
async function unsubUrl(email: string): Promise<string> {
  const e = email.trim().toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("newsletter:" + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(e));
  const token = Array.from(new Uint8Array(mac)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${UNSUB_FN_URL}?u=${encodeURIComponent(e)}&t=${token}`;
}

function render(name: string | null, unsubscribe: string) {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const hello = first ? `¡Hola ${esc(first)}!` : "¡Hola!";
  const preheader = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(PREHEADER)}</div>`;
  const html = HTML.replace("{{saludo}}", hello).replace("{{baja}}", esc(unsubscribe))
    .replace(/(<body[^>]*>)/, `$1${preheader}`);
  const text = `${first ? `¡Hola ${first}!` : "¡Hola!"}

Renovamos por completo la sección Editar catálogo. Ahora puedes cambiar el tema, los colores, el fondo, los botones y la letra de tu catálogo, y ver cómo queda en vivo antes de guardar.

- 12 temas listos para usar.
- Colores, fondo y letra a tu gusto.
- Botones con tu propio texto.
- Productos destacados y categorías a tu manera.
- Vista previa en vivo.

Cómo probarlo: entra a tu panel, ve a Mi catálogo → Editar y abre la sección Tema. El tema Claro está en todos los planes; los demás se guardan desde el plan Básico.

Dónde está disponible: en la web y en la app de Android. En iPhone llegará en unos días; mientras tanto puedes entrar desde el navegador.

Personalizar mi catálogo: https://auth.catalogohoy.com

Dejar de recibir novedades: ${unsubscribe}
© 2026 CatalogoHoy`;
  return { html, text };
}

async function sendEmail(to: string, name: string | null) {
  const unsubscribe = await unsubUrl(to);
  const { html, text } = render(name, unsubscribe);
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
      FromEmailAddress: FROM,
      ReplyToAddresses: [REPLY_TO],
      Destination: { ToAddresses: [to] },
      Content: { Simple: {
        Subject: { Data: SUBJECT, Charset: "UTF-8" },
        Body: { Html: { Data: html, Charset: "UTF-8" }, Text: { Data: text, Charset: "UTF-8" } },
        Headers: [
          { Name: "List-Unsubscribe", Value: `<${unsubscribe}>` },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ],
      } },
      ConfigurationSetName: "catalogohoy-prod",
      EmailTags: [{ Name: "type", Value: "announcement" }, { Name: "campaign", Value: CAMPAIGN }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

type Row = { user_id: number; name: string | null; email: string };

async function audience(): Promise<Row[]> {
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
  try {
    return await sql<Row[]>`
      with base as (
        select u.id, u.name, lower(trim(u.email)) as email,
          exists (select 1 from users_tenants ut where ut.user_id = u.id) as has_store,
          greatest(
            au.last_sign_in_at,
            (select max(o.created_at) from users_tenants ut join orders o on o.tenant_id = ut.tenant_id where ut.user_id = u.id),
            (select max(p.created_at) from users_tenants ut join products p on p.tenant_id = ut.tenant_id where ut.user_id = u.id)
          ) as act
        from users u
        left join auth.users au on au.id = u.auth_user_id
        where u.email is not null and trim(u.email) <> ''
      )
      select distinct on (b.email) b.id as user_id, b.name, b.email
      from base b
      where b.has_store
        and b.act > now() - make_interval(days => ${ACTIVE_DAYS})
        and b.email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
        and not exists (select 1 from newsletter_unsubscribes x where x.email = b.email)
        and not exists (
          select 1 from ses_email_events e
          where lower(e.recipient) = b.email
            and (e.complained_at is not null or (e.bounced_at is not null and e.bounce_type = 'Permanent'))
        )
        and not exists (
          select 1 from marketing_sends s
          where s.campaign = ${CAMPAIGN} and s.channel = 'email' and (s.user_id = b.id or lower(s.recipient) = b.email)
        )
      order by b.email, b.id`;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Gate: solo admin interno.
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { error: adminErr } = await userClient.rpc("_assert_internal_admin");
  if (adminErr) return json({ error: "Unauthorized" }, 403);

  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "audience") {
      return json({ campaign: CAMPAIGN, remaining: (await audience()).length });
    }
    if (body.action === "test") {
      const to = String(body.email ?? ADMIN_EMAIL).trim().toLowerCase();
      const res = await sendEmail(to, String(body.name ?? "Nicolas"));
      return json({ ok: res.ok, to, result: res.body }, res.ok ? 200 : 502);
    }
    if (body.action === "send") {
      const limit = Math.min(Math.max(Number(body.limit ?? 200), 1), 400);
      const all = await audience();
      const rows = all.slice(0, limit);
      let sent = 0, failed = 0;
      const errors: string[] = [];
      const CONCURRENCY = 8;
      for (let k = 0; k < rows.length; k += CONCURRENCY) {
        await Promise.all(rows.slice(k, k + CONCURRENCY).map(async (r) => {
          const res = await sendEmail(r.email, r.name);
          const err = res.ok ? null : JSON.stringify(res.body?.error ?? res.body?.message ?? res.body).slice(0, 500);
          if (res.ok) sent++; else { failed++; if (errors.length < 5) errors.push(err!); }
          await admin.from("marketing_sends").upsert({
            campaign: CAMPAIGN,
            channel: "email",
            user_id: r.user_id,
            recipient: r.email,
            status: res.ok ? "sent" : "failed",
            message_id: res.body?.MessageId ?? null,
            error: err,
          }, { onConflict: "campaign,channel,user_id", ignoreDuplicates: true });
        }));
      }
      return json({ campaign: CAMPAIGN, sent, failed, remaining: all.length - rows.length, errors });
    }
    return json({ error: "action debe ser audience, test o send" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

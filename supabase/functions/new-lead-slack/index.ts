import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Notificación de lead → Slack (#leads). Dos eventos:
//  - 'signup' (default): al registrarse/confirmar correo. La tienda aún no
//    tiene nombre real (el onboarding lo pide después) → NO mostramos el slug
//    temporal; solo correo, país, método y fuente.
//  - 'onboarding_completed': cuando el usuario termina el wizard y su tienda
//    ya tiene nombre + dirección reales → mensaje con catálogo, slug y botón.
// La disparan los triggers de la DB vía net.http_post con
// { event, type, table, record:{ user_id, tenant_id, ... } }.

const SOURCE_LABELS: Record<string, string> = {
  tiktok: "🎵 TikTok",
  instagram: "📸 Instagram",
  threads: "🧵 Threads",
  x: "✖️ X (Twitter)",
  twitter: "✖️ X (Twitter)",
  facebook: "👍 Facebook",
  youtube: "▶️ YouTube",
  linkedin: "💼 LinkedIn",
  google: "🔍 Google",
  bing: "🔍 Bing",
  whatsapp: "🟢 WhatsApp",
  blog: "📰 Blog",
  email: "✉️ Email",
  newsletter: "✉️ Newsletter",
};

function trafficLabel(source: string, medium: string, campaign: string): string {
  if (!source) return "🔗 Directo / desconocido";
  const base = SOURCE_LABELS[source.toLowerCase()] ?? `🔗 ${source}`;
  const extra = campaign && campaign.toLowerCase() !== "bio" ? campaign
    : medium && medium.toLowerCase() !== "social" ? medium
    : "";
  return extra ? `${base} · ${extra}` : base;
}

/** Slug provisional que crea el trigger de signup (mi-tienda-XXXX / tienda-XXXX):
 *  mientras lo tenga, la tienda no fue nombrada en el onboarding. */
const isTempSlug = (slug: string): boolean =>
  /^(mi-)?tienda-[a-z0-9-]+$/i.test(slug ?? "");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload.record;
    const event: string = payload.event === "onboarding_completed"
      ? "onboarding_completed"
      : "signup";

    if (!record?.user_id || !record?.tenant_id) {
      return new Response(
        JSON.stringify({ received: true, skipped: "missing user_id or tenant_id" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: user } = await admin
      .from("users")
      .select("name, last_name, email, phone, auth_user_id, created_at")
      .eq("id", record.user_id)
      .single();

    let whatsapp = "";
    let provider = "";
    let signupPlatform = "";
    let signupSource = "";
    let signupMedium = "";
    let signupCampaign = "";
    try {
      if (user?.auth_user_id) {
        const { data: authData } = await admin.auth.admin.getUserById(
          user.auth_user_id
        );
        const meta = authData?.user?.user_metadata ?? {};
        whatsapp = (meta.store_whatsapp as string) || "";
        provider = (authData?.user?.app_metadata?.provider as string) || "";
        signupPlatform = (meta.signup_platform as string) || "";
        signupSource = (meta.signup_source as string) || "";
        signupMedium = (meta.signup_medium as string) || "";
        signupCampaign = (meta.signup_campaign as string) || "";
      }
    } catch (_err) {
      whatsapp = "";
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("name, slug, country_code, country, created_at")
      .eq("id", record.tenant_id)
      .single();

    const slackUrl = Deno.env.get("SLACK_LEADS_WEBHOOK");
    if (!slackUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing SLACK_LEADS_WEBHOOK" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const userName = [user?.name, user?.last_name].filter(Boolean).join(" ") || "Sin nombre";
    const tempSlug = isTempSlug(tenant?.slug ?? "");
    const catalogUrl = tenant?.slug && !tempSlug
      ? `https://${tenant.slug}.catalogohoy.com`
      : null;

    const countryDisplay = tenant?.country
      ? `${tenant.country} (${tenant.country_code ?? "?"})`
      : tenant?.country_code ?? "N/A";

    const methodLabel =
      provider === "google" ? "🔵 Google"
      : provider === "email" ? "✉️ Correo"
      : provider || "N/A";

    const sourceLabel =
      signupPlatform === "ios" ? "📱 App iOS"
      : signupPlatform === "android" ? "🤖 App Android"
      : "🌐 Web";

    const trafficSource = trafficLabel(signupSource, signupMedium, signupCampaign);

    const completed = event === "onboarding_completed";

    // Campos comunes a los dos eventos.
    const fields: { type: string; text: string }[] = [
      { type: "mrkdwn", text: `*👤 Nombre:*\n${userName}` },
      { type: "mrkdwn", text: `*📧 Correo:*\n${user?.email ?? "N/A"}` },
      { type: "mrkdwn", text: `*📱 WhatsApp:*\n${whatsapp || user?.phone || "No proporcionado"}` },
      { type: "mrkdwn", text: `*🌍 País:*\n${countryDisplay}` },
      { type: "mrkdwn", text: `*🔐 Método:*\n${methodLabel}` },
      { type: "mrkdwn", text: `*📲 Origen:*\n${sourceLabel}` },
      { type: "mrkdwn", text: `*📈 Fuente:*\n${trafficSource}` },
    ];

    // El catálogo + slug solo tienen sentido con nombre real (onboarding hecho).
    if (completed || !tempSlug) {
      fields.splice(3, 0,
        { type: "mrkdwn", text: `*🏪 Catálogo:*\n${tenant?.name ?? "N/A"}` },
        { type: "mrkdwn", text: `*🔗 Slug:*\n${tenant?.slug ?? "N/A"}` }
      );
    }

    const headerText = completed
      ? "✅ Onboarding completado"
      : "🆕 Nuevo registro";
    const introText = completed
      ? `*${userName}* terminó de armar su tienda *${tenant?.name ?? ""}*.`
      : `*${userName}* se registró${tempSlug ? " (aún no completó el onboarding)" : ""}.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: headerText, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: introText },
      },
      { type: "section", fields },
    ];

    if (catalogUrl) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Visitar catálogo", emoji: true },
            url: catalogUrl,
          },
        ],
      });
    }

    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "CatálogoHoy · Leads" }],
    });

    const r = await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [{ color: completed ? "#5b5ef0" : "#9ca3af", blocks }],
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return new Response(
        JSON.stringify({ ok: false, error: `Slack ${r.status}: ${text}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, event }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Notificación de nuevo lead → Slack (#leads).
//
// Reemplaza a la función legacy `new-lead-discord`. La disparan los triggers
// de la DB (`notify_new_lead` y `notify_lead_on_email_confirm`) vía
// net.http_post cuando un owner por defecto completa su registro y confirma
// el email. Recibe { type, table, record:{ user_id, tenant_id, ... } }.
//
// Postea un mensaje Block Kit al Incoming Webhook de #leads (SLACK_LEADS_WEBHOOK).

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload.record;

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

    // Fetch user details
    const { data: user } = await admin
      .from("users")
      .select("name, last_name, email, phone, auth_user_id, created_at")
      .eq("id", record.user_id)
      .single();

    // Datos que viven en el auth user (una sola lectura para los tres):
    //  - WhatsApp elegido en el signup (`user_metadata.store_whatsapp`;
    //    `users.phone` suele estar vacío).
    //  - Método de registro (`app_metadata.provider`: 'email' | 'google').
    //  - Plataforma de registro (`user_metadata.signup_platform`, la setea el
    //    cliente en el signup: 'web' | 'ios' | 'android').
    // Best-effort — si la lectura falla, seguimos sin esos datos.
    let whatsapp = "";
    let provider = "";
    let signupPlatform = "";
    try {
      if (user?.auth_user_id) {
        const { data: authData } = await admin.auth.admin.getUserById(
          user.auth_user_id
        );
        whatsapp =
          (authData?.user?.user_metadata?.store_whatsapp as string) || "";
        provider = (authData?.user?.app_metadata?.provider as string) || "";
        signupPlatform =
          (authData?.user?.user_metadata?.signup_platform as string) || "";
      }
    } catch (_err) {
      whatsapp = "";
    }

    // Fetch tenant details — country picked at signup lives here.
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
    const catalogUrl = tenant?.slug
      ? `https://${tenant.slug}.catalogohoy.com`
      : null;

    // Prefer the Spanish label when present (set at signup), fall back to
    // the ISO code, then "N/A".
    const countryDisplay = tenant?.country
      ? `${tenant.country} (${tenant.country_code ?? "?"})`
      : tenant?.country_code ?? "N/A";

    // Con qué se registró: correo o Google.
    const methodLabel =
      provider === "google" ? "🔵 Google"
      : provider === "email" ? "✉️ Correo"
      : provider || "N/A";

    // Por dónde se registró. Sin dato asumimos Web (hoy no hay signup nativo
    // en producción; cuando la app móvil registre, el cliente setea el valor).
    const sourceLabel =
      signupPlatform === "ios" ? "📱 App iOS"
      : signupPlatform === "android" ? "🤖 App Android"
      : "🌐 Web";

    const fields: { type: string; text: string }[] = [
      { type: "mrkdwn", text: `*👤 Nombre:*\n${userName}` },
      { type: "mrkdwn", text: `*📧 Correo:*\n${user?.email ?? "N/A"}` },
      { type: "mrkdwn", text: `*📱 WhatsApp:*\n${whatsapp || user?.phone || "No proporcionado"}` },
      { type: "mrkdwn", text: `*🏪 Catálogo:*\n${tenant?.name ?? "N/A"}` },
      { type: "mrkdwn", text: `*🔗 Slug:*\n${tenant?.slug ?? "N/A"}` },
      { type: "mrkdwn", text: `*🌍 País:*\n${countryDisplay}` },
      { type: "mrkdwn", text: `*🔐 Método:*\n${methodLabel}` },
      { type: "mrkdwn", text: `*📲 Origen:*\n${sourceLabel}` },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "🆕 Nuevo Lead Registrado", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${userName}* se ha registrado y creado su catálogo.`,
        },
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
        attachments: [{ color: "#22c55e", blocks }],
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return new Response(
        JSON.stringify({ ok: false, error: `Slack ${r.status}: ${text}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
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

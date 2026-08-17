import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Traductor Vercel → Slack (#deploys).
//
// Vercel manda Account Webhooks con su propio JSON ({ id, type, payload }).
// Slack no lo entiende, así que esta función:
//   1. Verifica la firma HMAC-SHA1 (header x-vercel-signature) con el secret
//      del webhook (VERCEL_WEBHOOK_SECRET) — así nadie más puede postear.
//   2. Traduce el evento a un mensaje de Slack Block Kit.
//   3. Lo postea al Incoming Webhook de #deploys (SLACK_DEPLOYS_WEBHOOK).
//
// Se despliega con verify_jwt: false — Vercel llama sin sesión de Supabase;
// la autenticidad se garantiza con la firma del webhook.

const SLACK_DEPLOYS_WEBHOOK = Deno.env.get("SLACK_DEPLOYS_WEBHOOK");
const VERCEL_WEBHOOK_SECRET = Deno.env.get("VERCEL_WEBHOOK_SECRET");

function ok(body: Record<string, unknown> = { received: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Firma de Vercel: HMAC-SHA1 del body crudo, hex, en el header
// x-vercel-signature. https://vercel.com/docs/webhooks/webhooks-api#securing-webhooks
async function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Comparación de longitud constante para evitar timing attacks.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// Presentación por tipo de evento: emoji, texto legible y color de la barra.
const EVENT_META: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  "deployment.created":   { emoji: "🚀", label: "Deploy iniciado",    color: "#6366f1" },
  "deployment.succeeded": { emoji: "✅", label: "Deploy exitoso",     color: "#22c55e" },
  "deployment.ready":     { emoji: "✅", label: "Deploy listo",       color: "#22c55e" },
  "deployment.promoted":  { emoji: "🎉", label: "Deploy promovido a producción", color: "#16a34a" },
  "deployment.error":     { emoji: "❌", label: "Deploy fallido",     color: "#ef4444" },
  "deployment.canceled":  { emoji: "🚫", label: "Deploy cancelado",   color: "#94a3b8" },
  "deployment.rollback":  { emoji: "⏪", label: "Rollback aplicado",  color: "#f59e0b" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: any, ...paths: string[]): string | null {
  for (const path of paths) {
    let cur = obj;
    let okPath = true;
    for (const key of path.split(".")) {
      if (cur && typeof cur === "object" && key in cur) cur = cur[key];
      else { okPath = false; break; }
    }
    if (okPath && cur != null && cur !== "") return String(cur);
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return ok();
  if (req.method !== "POST") return ok();

  const rawBody = await req.text();

  // Verificar firma (si hay secret configurado — recomendado siempre).
  if (VERCEL_WEBHOOK_SECRET) {
    const sig = req.headers.get("x-vercel-signature");
    const valid = await verifySignature(rawBody, sig, VERCEL_WEBHOOK_SECRET);
    if (!valid) {
      console.error("vercel-deploy-slack: firma inválida");
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    console.warn("VERCEL_WEBHOOK_SECRET no configurado — firma no verificada");
  }

  if (!SLACK_DEPLOYS_WEBHOOK) {
    console.error("SLACK_DEPLOYS_WEBHOOK no configurado");
    return ok();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return ok();
  }

  const type: string = event?.type ?? "unknown";
  const meta = EVENT_META[type];
  // Ignorar eventos que no nos interesan (proyecto, feature flags, firewall…).
  if (!meta) return ok();

  const payload = event?.payload ?? {};
  const projectName =
    pick(payload, "deployment.name", "project.name", "name") ?? "proyecto";
  const target =
    pick(payload, "target", "deployment.target") ?? "preview";
  const url = pick(payload, "deployment.url", "url");
  const deployUrl = url ? (url.startsWith("http") ? url : `https://${url}`) : null;
  const inspectorUrl = pick(payload, "deployment.inspectorUrl", "links.deployment");
  const branch = pick(
    payload,
    "deployment.meta.githubCommitRef",
    "deployment.meta.gitBranch",
    "meta.githubCommitRef",
  );
  const commitMsg = pick(
    payload,
    "deployment.meta.githubCommitMessage",
    "meta.githubCommitMessage",
  );
  const author = pick(
    payload,
    "deployment.meta.githubCommitAuthorName",
    "meta.githubCommitAuthorName",
    "user.username",
  );

  const targetLabel = target === "production" ? "🌐 producción" : "🔎 preview";

  const fields: { type: string; text: string }[] = [
    { type: "mrkdwn", text: `*Proyecto:*\n${projectName}` },
    { type: "mrkdwn", text: `*Entorno:*\n${targetLabel}` },
  ];
  if (branch) fields.push({ type: "mrkdwn", text: `*Rama:*\n${branch}` });
  if (author) fields.push({ type: "mrkdwn", text: `*Autor:*\n${author}` });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${meta.emoji} ${meta.label}`, emoji: true },
    },
    { type: "section", fields },
  ];
  if (commitMsg) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Commit:*\n${commitMsg}` },
    });
  }
  // Botones a la URL del deploy y al inspector, si existen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buttons: any[] = [];
  if (deployUrl) {
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: "Ver deploy", emoji: true },
      url: deployUrl,
    });
  }
  if (inspectorUrl) {
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: "Inspector", emoji: true },
      url: inspectorUrl,
    });
  }
  if (buttons.length) blocks.push({ type: "actions", elements: buttons });

  await fetch(SLACK_DEPLOYS_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attachments: [{ color: meta.color, blocks }],
    }),
  }).catch((err) => console.error("slack post failed:", err));

  return ok();
});

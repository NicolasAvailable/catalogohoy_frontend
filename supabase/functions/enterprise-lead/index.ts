import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Se deploya con verify_jwt: false porque la landing llama sin sesión
// (la publishable key no es un JWT). A cambio: validación estricta del
// payload + honeypot. La tabla enterprise_leads tiene RLS sin policies,
// solo este service role escribe.
// Notificaciones a Slack (#leads). El secret SLACK_ENTERPRISE_LEADS_WEBHOOK
// se setea vía Supabase CLI.
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_ENTERPRISE_LEADS_WEBHOOK");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const RANGES = ["lt_100", "100_500", "500_2000", "gt_2000"] as const;
const CATALOGS = ["1", "2_3", "4_10", "gt_10"] as const;
const TEAM_SIZES = ["solo", "2_5", "6_15", "gt_15"] as const;
const NEEDS = [
  "multi_catalogs",
  "big_team",
  "migration",
  "api_integrations",
  "custom_domain",
  "dedicated_support",
  "centralized_billing",
  "other",
] as const;

type Range = (typeof RANGES)[number];
type Catalogs = (typeof CATALOGS)[number];
type TeamSize = (typeof TEAM_SIZES)[number];
type Need = (typeof NEEDS)[number];

interface Answers {
  businessName: string;
  country?: string;
  website?: string;
  productsRange: Range;
  ordersRange: Range;
  catalogsNeeded: Catalogs;
  teamSize: TeamSize;
  needs: Need[];
  name: string;
  email: string;
  phone?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(value: unknown, required: boolean): string | null {
  if (typeof value !== "string") return required ? null : "";
  const trimmed = value.trim().slice(0, 200);
  if (required && !trimmed) return null;
  return trimmed;
}

function parseAnswers(raw: unknown): Answers | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;

  const businessName = str(a.businessName, true);
  const name = str(a.name, true);
  const email = str(a.email, true);
  if (!businessName || !name || !email || !EMAIL_RE.test(email)) return null;

  if (!RANGES.includes(a.productsRange as Range)) return null;
  if (!RANGES.includes(a.ordersRange as Range)) return null;
  if (!CATALOGS.includes(a.catalogsNeeded as Catalogs)) return null;
  if (!TEAM_SIZES.includes(a.teamSize as TeamSize)) return null;

  const needs = Array.isArray(a.needs)
    ? (a.needs.filter((n) => NEEDS.includes(n as Need)) as Need[]).slice(0, 8)
    : [];

  return {
    businessName,
    country: str(a.country, false) ?? "",
    website: str(a.website, false) ?? "",
    productsRange: a.productsRange as Range,
    ordersRange: a.ordersRange as Range,
    catalogsNeeded: a.catalogsNeeded as Catalogs,
    teamSize: a.teamSize as TeamSize,
    needs,
    name,
    email,
    phone: str(a.phone, false) ?? "",
  };
}

// Debe mantenerse en sync con scoreEnterpriseLead() del admin
// (libs/catalogohoy/plan/src/domain/enterprise.model.ts) y de la landing
// (apps/landing/src/lib/enterprise-lead.ts). Esta copia es la que se persiste.
function scoreLead(a: Answers): { score: number; qualified: boolean } {
  let s = 0;
  s += { "1": 0, "2_3": 1, "4_10": 4, gt_10: 5 }[a.catalogsNeeded];
  s += { solo: 0, "2_5": 0, "6_15": 2, gt_15: 3 }[a.teamSize];
  s += { lt_100: 0, "100_500": 0, "500_2000": 1, gt_2000: 2 }[a.productsRange];
  s += { lt_100: 0, "100_500": 0, "500_2000": 1, gt_2000: 2 }[a.ordersRange];
  const needPts: Record<Need, number> = {
    api_integrations: 2,
    migration: 1,
    dedicated_support: 1,
    centralized_billing: 1,
    multi_catalogs: 1,
    big_team: 1,
    custom_domain: 0,
    other: 0,
  };
  s += Math.min(4, a.needs.reduce((acc, n) => acc + (needPts[n] ?? 0), 0));
  return { score: s, qualified: s >= 4 };
}

const RANGE_LABELS: Record<Range, string> = {
  lt_100: "Menos de 100",
  "100_500": "100 – 500",
  "500_2000": "500 – 2.000",
  gt_2000: "Más de 2.000",
};
const CATALOG_LABELS: Record<Catalogs, string> = {
  "1": "1",
  "2_3": "2 – 3",
  "4_10": "4 – 10",
  gt_10: "Más de 10",
};
const TEAM_LABELS: Record<TeamSize, string> = {
  solo: "Solo yo",
  "2_5": "2 – 5",
  "6_15": "6 – 15",
  gt_15: "Más de 15",
};
const NEED_LABELS: Record<Need, string> = {
  multi_catalogs: "Varios catálogos",
  big_team: "Equipo grande",
  migration: "Migración de datos",
  api_integrations: "API / integraciones",
  custom_domain: "Dominio propio",
  dedicated_support: "Soporte dedicado",
  centralized_billing: "Facturación centralizada",
  other: "Otro",
};

async function notifySlack(
  answers: Answers,
  source: string,
  tenantSlug: string | null,
  score: number,
  qualified: boolean,
): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.error("Slack webhook for enterprise leads not configured");
    return;
  }
  const now = new Date().toLocaleString("es-VE", {
    timeZone: "America/Caracas",
  });
  const fuente =
    source === "admin" ? `admin (${tenantSlug ?? "?"})` : "landing";
  const necesidades =
    answers.needs.map((n) => NEED_LABELS[n]).join(", ") || "—";

  const payload = {
    attachments: [
      {
        color: qualified ? "#b45309" : "#64748b",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `🏢 Lead Enterprise ${qualified ? "✅ calificado" : "— no calificado"}`,
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Negocio:*\n${answers.businessName}` },
              { type: "mrkdwn", text: `*Nombre:*\n${answers.name}` },
              { type: "mrkdwn", text: `*Email:*\n${answers.email}` },
              { type: "mrkdwn", text: `*Teléfono:*\n${answers.phone || "—"}` },
              { type: "mrkdwn", text: `*País:*\n${answers.country || "—"}` },
              { type: "mrkdwn", text: `*Fuente:*\n${fuente}` },
              { type: "mrkdwn", text: `*Productos:*\n${RANGE_LABELS[answers.productsRange]}` },
              { type: "mrkdwn", text: `*Pedidos/mes:*\n${RANGE_LABELS[answers.ordersRange]}` },
              { type: "mrkdwn", text: `*Catálogos:*\n${CATALOG_LABELS[answers.catalogsNeeded]}` },
              { type: "mrkdwn", text: `*Equipo:*\n${TEAM_LABELS[answers.teamSize]}` },
              { type: "mrkdwn", text: `*Score:*\n${score}` },
              { type: "mrkdwn", text: `*Fecha:*\n${now}` },
            ],
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Necesidades:*\n${necesidades}` },
          },
        ],
      },
    ],
  };
  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  // Honeypot: los bots lo llenan, los humanos no lo ven. Fake success.
  if (typeof body.company_hp === "string" && body.company_hp.trim() !== "") {
    return jsonResponse({ success: true, qualified: false, score: 0 });
  }

  const source = body.source === "admin" ? "admin" : "landing";
  const tenantSlug =
    source === "admin" && typeof body.tenantSlug === "string"
      ? body.tenantSlug.trim().slice(0, 100) || null
      : null;

  const answers = parseAnswers(body.answers);
  if (!answers) {
    return jsonResponse({ success: false, error: "Invalid payload" }, 400);
  }

  const { score, qualified } = scoreLead(answers);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await admin.from("enterprise_leads").insert({
    source,
    tenant_slug: tenantSlug,
    business_name: answers.businessName,
    country: answers.country || null,
    website: answers.website || null,
    name: answers.name,
    email: answers.email,
    phone: answers.phone || null,
    products_range: answers.productsRange,
    orders_range: answers.ordersRange,
    catalogs_needed: answers.catalogsNeeded,
    team_size: answers.teamSize,
    needs: answers.needs,
    score,
    qualified,
    answers: answers as unknown as Record<string, unknown>,
  });

  if (error) {
    console.error("enterprise-lead insert error:", error.message);
    return jsonResponse({ success: false, error: "Could not save lead" }, 500);
  }

  // Fire-and-forget: Slack caído no debe romper el lead ya guardado.
  notifySlack(answers, source, tenantSlug, score, qualified).catch((err) =>
    console.error("enterprise-lead slack error:", err),
  );

  return jsonResponse({ success: true, qualified, score });
});

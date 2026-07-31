import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AwsClient } from "npm:aws4fetch@1";
import { createClient } from "npm:@supabase/supabase-js@2";

// Panel de emails (SES) para el interno. Gated: solo admin interno
// (_assert_internal_admin). Devuelve cuota/límite, stats de 14 días
// (enviados/entregados/rebotes/quejas/rechazos), serie diaria y costo estimado.
// Aperturas/clics NO se incluyen: requieren activar open/click tracking en el
// config set (fase 2). Precio SES: $0.10 / 1000 emails.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    // --- Gate: solo admin interno ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { error: adminErr } = await userClient.rpc("_assert_internal_admin");
    if (adminErr) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const region = Deno.env.get("AWS_SES_REGION") ?? "sa-east-1";
    const aws = new AwsClient({
      accessKeyId: Deno.env.get("AWS_SES_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")!,
      region,
      service: "ses",
    });
    const base = `https://email.${region}.amazonaws.com`;

    // Cuota / límite (SES v2)
    const accRes = await aws.fetch(`${base}/v2/email/account`, { method: "GET" });
    const account = await accRes.json().catch(() => ({}));

    // Send statistics (SES v1, XML, ~14 días en datapoints de ~15min)
    const statsRes = await aws.fetch(`${base}/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "Action=GetSendStatistics&Version=2010-12-01",
    });
    const xml = await statsRes.text();
    const members = xml.match(/<member>[\s\S]*?<\/member>/g) ?? [];
    const pick = (m: string, tag: string) => {
      const r = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(m);
      return r ? r[1] : "";
    };
    const points = members.map((m) => ({
      ts: pick(m, "Timestamp"),
      attempts: Number(pick(m, "DeliveryAttempts")) || 0,
      bounces: Number(pick(m, "Bounces")) || 0,
      complaints: Number(pick(m, "Complaints")) || 0,
      rejects: Number(pick(m, "Rejects")) || 0,
    }));

    // Agregar por día (UTC)
    const byDay = new Map<string, { day: string; attempts: number; bounces: number; complaints: number; rejects: number }>();
    for (const p of points) {
      const day = p.ts.slice(0, 10);
      if (!day) continue;
      const cur = byDay.get(day) ?? { day, attempts: 0, bounces: 0, complaints: 0, rejects: 0 };
      cur.attempts += p.attempts; cur.bounces += p.bounces; cur.complaints += p.complaints; cur.rejects += p.rejects;
      byDay.set(day, cur);
    }
    const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    const totals = daily.reduce((a, d) => ({
      attempts: a.attempts + d.attempts,
      bounces: a.bounces + d.bounces,
      complaints: a.complaints + d.complaints,
      rejects: a.rejects + d.rejects,
    }), { attempts: 0, bounces: 0, complaints: 0, rejects: 0 });
    const delivered = Math.max(0, totals.attempts - totals.bounces - totals.rejects);

    // Costo (SES $0.10 / 1000). Mes en curso (UTC).
    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthAttempts = daily.filter((d) => d.day.startsWith(ym)).reduce((s, d) => s + d.attempts, 0);
    const round4 = (n: number) => Math.round(n * 10000) / 10000;

    return new Response(JSON.stringify({
      quota: account?.SendQuota ?? null,
      prodAccess: account?.ProductionAccessEnabled ?? null,
      sendingEnabled: account?.SendingEnabled ?? null,
      windowDays: 14,
      totals: { ...totals, delivered },
      bounceRate: totals.attempts > 0 ? totals.bounces / totals.attempts : 0,
      complaintRate: totals.attempts > 0 ? totals.complaints / totals.attempts : 0,
      daily,
      cost: {
        pricePerThousandUsd: 0.10,
        windowUsd: round4(totals.attempts * 0.0001),
        monthAttempts,
        monthUsd: round4(monthAttempts * 0.0001),
      },
      trackingEnabled: false,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

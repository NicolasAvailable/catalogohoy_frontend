import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

// =============================================================================
// storage-backfill — migración de Storage a S3 (fase 2, CAT-88).
//
// Copia los objetos YA existentes del bucket `catalogohoy` de Supabase Storage
// al bucket S3 (mismo key), para después reescribir las URLs de la DB a
// cdn.catalogohoy.com. Trabaja sobre la cola `public.storage_backfill`
// (migración 20261021_storage_backfill.sql): reclama un lote, copia con
// concurrencia limitada y marca done/error. Idempotente: si el objeto ya está
// en S3 con el mismo tamaño, no lo vuelve a subir.
//
// La dispara pg_cron (net.http_post) con `x-webhook-secret`.
//
//   POST { action?: 'copy', limit?: number, concurrency?: number, batches?: number }
//     -> { claimed, done, skipped, errors, ms }
//   POST { action: 'verify', keys: string[] }
//     -> [{ key, s3, cdn }]  (HEAD contra S3 y contra el CDN)
//
// Secrets: S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
//          S3_CDN_BASE_URL. El `x-webhook-secret` se valida contra
//          `storage_backfill_config.secret` (tabla sin acceso para anon/auth).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const S3_REGION = Deno.env.get("S3_REGION") ?? "";
const S3_BUCKET = Deno.env.get("S3_BUCKET") ?? "";
const S3_CDN_BASE_URL = (Deno.env.get("S3_CDN_BASE_URL") ?? "").replace(/\/+$/, "");
const SOURCE_BUCKET = "catalogohoy";
// Cortamos de reclamar lotes nuevos pasado este tiempo (el límite de la edge es mayor).
const TIME_BUDGET_MS = 100_000;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const aws = new AwsClient({
  accessKeyId: Deno.env.get("S3_ACCESS_KEY_ID") ?? "",
  secretAccessKey: Deno.env.get("S3_SECRET_ACCESS_KEY") ?? "",
  region: S3_REGION,
  service: "s3",
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
const s3Url = (key: string) => `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${encodeKey(key)}`;

interface Row { key: string; size: number | null; mimetype: string | null }

async function copyOne(row: Row): Promise<"done" | "skipped"> {
  const head = await aws.fetch(s3Url(row.key), { method: "HEAD" });
  if (head.ok && row.size != null && Number(head.headers.get("content-length")) === Number(row.size)) {
    return "skipped";
  }

  const src = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${SOURCE_BUCKET}/${encodeKey(row.key)}`,
    { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  );
  if (!src.ok) throw new Error(`source ${src.status}`);
  const body = await src.arrayBuffer();

  const put = await aws.fetch(s3Url(row.key), {
    method: "PUT",
    body,
    headers: {
      "content-type": row.mimetype || src.headers.get("content-type") || "application/octet-stream",
      // Las keys llevan timestamp → inmutables; el CDN puede cachear 1 año.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
  if (!put.ok) throw new Error(`s3 put ${put.status}: ${(await put.text()).slice(0, 200)}`);
  return "done";
}

async function runCopy(limit: number, concurrency: number, maxBatches: number) {
  const started = Date.now();
  const stats = { claimed: 0, done: 0, skipped: 0, errors: 0, ms: 0 };

  for (let b = 0; b < maxBatches && Date.now() - started < TIME_BUDGET_MS; b++) {
    const { data: rows, error } = await admin.rpc("storage_backfill_claim", { p_limit: limit });
    if (error) throw new Error(error.message);
    if (!rows?.length) break;
    stats.claimed += rows.length;

    const queue = [...rows] as Row[];
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        try {
          const r = await copyOne(row);
          stats[r]++;
          await admin.from("storage_backfill")
            .update({ status: "done", copied_at: new Date().toISOString(), error: null })
            .eq("key", row.key);
        } catch (e) {
          stats.errors++;
          await admin.from("storage_backfill")
            .update({ status: "error", error: String((e as Error).message ?? e).slice(0, 500) })
            .eq("key", row.key);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }
  stats.ms = Date.now() - started;
  return stats;
}

async function verify(keys: string[]) {
  return await Promise.all(keys.slice(0, 50).map(async (key) => {
    const s3 = (await aws.fetch(s3Url(key), { method: "HEAD" })).status;
    const cdn = S3_CDN_BASE_URL
      ? (await fetch(`${S3_CDN_BASE_URL}/${encodeKey(key)}`, { method: "HEAD" })).status
      : null;
    return { key, s3, cdn };
  }));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  const { data: cfg } = await admin.from("storage_backfill_config").select("secret").eq("id", 1).maybeSingle();
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!cfg?.secret || provided !== cfg.secret) return json({ error: "Unauthorized" }, 401);
  if (!S3_BUCKET || !S3_REGION) return json({ error: "S3 no está configurado" }, 503);

  let body: { action?: string; limit?: number; concurrency?: number; batches?: number; keys?: string[] } = {};
  try { body = await req.json(); } catch { /* body vacío = copy por defecto */ }

  try {
    if (body.action === "verify") return json(await verify(body.keys ?? []));
    const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 500);
    const concurrency = Math.min(Math.max(Number(body.concurrency) || 8, 1), 20);
    const batches = Math.max(Number(body.batches) || Infinity, 1);
    return json(await runCopy(limit, concurrency, batches));
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

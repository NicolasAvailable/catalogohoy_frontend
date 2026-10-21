import { AwsClient } from "npm:aws4fetch@1.0.20";

// =============================================================================
// Subida server-side a S3 (migración de Storage, CAT-88). Las edges que antes
// hacían `admin.storage.from('catalogohoy').upload()` usan esto: sube el objeto
// al bucket de S3 y devuelve la URL pública del CDN (cdn.catalogohoy.com), que
// es lo que se guarda en la DB. Mismos secrets que `storage-sign-upload`.
// =============================================================================

const S3_REGION = Deno.env.get("S3_REGION") ?? "";
const S3_BUCKET = Deno.env.get("S3_BUCKET") ?? "";
const S3_CDN_BASE_URL = (Deno.env.get("S3_CDN_BASE_URL") ?? "").replace(/\/+$/, "");

const aws = new AwsClient({
  accessKeyId: Deno.env.get("S3_ACCESS_KEY_ID") ?? "",
  secretAccessKey: Deno.env.get("S3_SECRET_ACCESS_KEY") ?? "",
  region: S3_REGION,
  service: "s3",
});

/** Sube `body` a S3 con la key dada y devuelve la URL pública (CDN). */
export async function uploadToS3(
  key: string,
  body: Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<string> {
  if (!S3_BUCKET || !S3_REGION) throw new Error("S3 no está configurado");
  const path = key.split("/").map(encodeURIComponent).join("/");
  const res = await aws.fetch(`https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${path}`, {
    method: "PUT",
    body,
    headers: {
      "content-type": contentType,
      // Las keys llevan timestamp + random → inmutables.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) throw new Error(`S3 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const base = S3_CDN_BASE_URL || `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
  return `${base}/${path}`;
}

import { SupabaseClientProvider } from '@catalogohoy/core';

// =============================================================================
// Storage en S3 (migración desde Supabase Storage).
//
// - compressImage(): redimensiona + re-encodea a WebP (con fallback a JPEG en
//   navegadores viejos que no sepan encodear WebP en canvas). Comparte la
//   lógica que antes vivía suelta en el uploader.
// - signedUpload(): pide una URL prefirmada a la edge `storage-sign-upload` y
//   sube el blob DIRECTO a S3 (PUT). Devuelve la URL pública (CDN) para guardar
//   en la DB — mismo contrato que antes devolvía getPublicUrl de Supabase.
//
// Las URLs viejas de supabase.co siguen sirviéndose desde Supabase; esto solo
// cambia a dónde van las subidas NUEVAS.
// =============================================================================

export type UploadKind = 'product' | 'banner' | 'chat' | 'ai' | 'invoice' | 'import';

export interface CompressOptions {
  /** Ancho máximo en px (se escala manteniendo proporción). */
  maxWidth?: number;
  /** Calidad 0..1 para el encoder con pérdida. */
  quality?: number;
}

let webpSupport: boolean | null = null;
/** ¿El canvas de este navegador sabe ENCODEAR WebP? (Safari <16 no). Si no,
 *  caemos a JPEG para no terminar subiendo un PNG gigante por accidente. */
function canEncodeWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

/** Formato de salida de la compresión en este navegador. */
export function preferredImageFormat(): { mime: string; ext: string } {
  return canEncodeWebp()
    ? { mime: 'image/webp', ext: 'webp' }
    : { mime: 'image/jpeg', ext: 'jpeg' };
}

/** Redimensiona a maxWidth y re-encodea (WebP si se puede, si no JPEG). */
export function compressImage(
  file: Blob,
  opts: CompressOptions = {},
  decodeErrorMsg = 'No pudimos leer esta imagen. Verifica que sea JPG, PNG o WEBP e intenta de nuevo.'
): Promise<Blob> {
  const maxWidth = opts.maxWidth ?? 1200;
  const quality = opts.quality ?? 0.8;
  const { mime } = preferredImageFormat();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(
                new Error('No pudimos procesar esta imagen. Intenta con otra foto.')
              ),
        mime,
        quality
      );
    };
    img.onerror = () => reject(new Error(decodeErrorMsg));
    img.src = URL.createObjectURL(file);
  });
}

/** Sube un blob a S3 vía URL prefirmada. Devuelve la URL pública (CDN). */
export async function signedUpload(
  blob: Blob,
  fileName: string,
  contentType: string,
  kind: UploadKind,
  tenantId?: number,
  slug?: string
): Promise<string> {
  const client = SupabaseClientProvider.getInstance();
  const invoke = () =>
    client.functions.invoke('storage-sign-upload', {
      body: { kind, fileName, contentType, tenantId, slug },
    });

  let { data, error } = await invoke();
  // 401 casi siempre = el access token expiró y el request llegó anónimo.
  // Refrescamos la sesión una vez y reintentamos (igual que hacía el upload a
  // Supabase Storage ante el error de RLS).
  if (error || !data?.uploadUrl) {
    await client.auth.refreshSession();
    ({ data, error } = await invoke());
  }
  if (error || !data?.uploadUrl) {
    throw new Error(
      (data as { error?: string })?.error ||
        error?.message ||
        'Tu sesión expiró o no pudimos preparar la subida. Recarga e intenta de nuevo.'
    );
  }
  const { uploadUrl, publicUrl, headers } = data as {
    uploadUrl: string;
    publicUrl: string;
    headers: Record<string, string>;
  };
  const res = await fetch(uploadUrl, { method: 'PUT', headers, body: blob });
  if (!res.ok) {
    throw new Error('No pudimos subir el archivo. Intenta de nuevo.');
  }
  return publicUrl;
}

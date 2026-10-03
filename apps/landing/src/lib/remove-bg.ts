// Cliente de la herramienta gratuita de quita-fondo (lead-gen).
// Llama a la edge function pública `remove-bg-free` (sin login, cuota por IP).
// Mismas constantes inline que enterprise-lead.ts (la landing no usa supabase-js).

const SUPABASE_URL = "https://yvkurjivijnhliofmfmj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs";

/** Signup con UTM para medir la conversión del embudo de la herramienta. */
export const SIGNUP_TOOL_URL =
  "https://auth.catalogohoy.com/signup?utm_source=quita-fondo&utm_medium=tool&utm_campaign=lead-tool";

export interface RemoveBgResult {
  ok: boolean;
  url?: string;
  /** Usos gratis que quedan hoy tras este (por IP). */
  remaining?: number;
  error?: string;
  /** true si se agotó el límite diario gratis → mostrar gate de registro. */
  quota?: boolean;
}

export async function removeBackgroundFree(
  dataUrl: string,
  honeypot = ""
): Promise<RemoveBgResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/remove-bg-free`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: dataUrl, hp: honeypot }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      url?: string;
      remaining?: number;
      error?: string;
      code?: string;
    };
    if (!res.ok || !data.success) {
      return {
        ok: false,
        error: data.error ?? "No se pudo quitar el fondo. Inténtalo de nuevo.",
        quota: data.code === "quota",
      };
    }
    return { ok: true, url: data.url, remaining: data.remaining };
  } catch {
    return {
      ok: false,
      error: "No se pudo conectar. Revisa tu internet e intenta de nuevo.",
    };
  }
}

/** Lee un File como data URL (base64) para mandarlo a la edge fn. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/** Descarga una imagen (url) como archivo local. */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo descargar la imagen");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Compone el PNG transparente sobre fondo blanco y lo descarga (JPG).
 *  Útil para marketplaces/catálogos que piden fondo blanco. */
export async function downloadWithWhiteBg(
  url: string,
  filename: string
): Promise<void> {
  // Cargar vía blob (object URL same-origin) para que el canvas NO quede
  // "tainted" por CORS y toBlob() funcione siempre.
  const srcRes = await fetch(url);
  if (!srcRes.ok) throw new Error("No se pudo descargar la imagen");
  const srcBlob = await srcRes.blob();
  const srcUrl = URL.createObjectURL(srcBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      img.src = srcUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    if (!blob) throw new Error("No se pudo generar la imagen");
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}

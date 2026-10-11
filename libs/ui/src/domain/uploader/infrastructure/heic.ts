// HEIC/HEIF (fotos de iPhone o Samsung con "alta eficiencia") no se pueden
// decodificar con <img> en Chrome: hay que convertirlas antes con heic2any
// (chunk lazy, solo se descarga si aparece un HEIC). Detectamos por MIME,
// extensión y magic bytes — WhatsApp/descargas a veces renombran a .jpg.
// Compartido entre el uploader (`UploaderService`) y el chat CRM
// (`ChatService.uploadMedia`).
const HEIC_MIME = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIC_BRANDS = /heic|heix|heim|heis|hevc|hevx|heif|mif1|msf1/;

export async function isHeicFile(file: File): Promise<boolean> {
  if (HEIC_MIME.has((file.type || '').toLowerCase())) return true;
  if (/\.(heic|heif)$/i.test(file.name || '')) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const ascii = String.fromCharCode(...head);
    return ascii.slice(4, 8) === 'ftyp' && HEIC_BRANDS.test(ascii.slice(8, 16));
  } catch {
    return false;
  }
}

/** Convierte un HEIC a JPEG. Devuelve `null` si la conversión falla (p.ej.
 *  un JPEG renombrado a .heic): el caller decide el fallback. */
export async function convertHeicToJpeg(file: File): Promise<Blob | null> {
  try {
    const { default: heic2any } = await import('heic2any');
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    return Array.isArray(result) ? result[0] : result;
  } catch {
    return null;
  }
}

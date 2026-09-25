import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { BaseUploaderOutput, E } from '@shared/domain';
import { Observable, of } from 'rxjs';
import { BaseUploaderService } from '../domain/uploader.service';
import { convertHeicToJpeg, isHeicFile } from './heic';

const MAX_WIDTH = 1200;
const QUALITY = 0.8;
// Images get a fixed extension because we always re-encode to JPEG via
// canvas. Videos keep their original extension so the browser knows the
// container format (mp4/webm) and the public catalog's <video> tag picks
// the right decoder.
const ALLOWED_VIDEO_EXT = new Set(['mp4', 'webm', 'ogg', 'ogv']);
const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
};
const MSG_UNREADABLE =
  'No pudimos leer esta imagen. Verifica que sea JPG, PNG o WEBP e intenta de nuevo.';
const MSG_HEIC =
  'No pudimos convertir esta foto (formato HEIC). Compártela o expórtala como JPG e intenta de nuevo.';

@Injectable({ providedIn: 'root' })
export class UploaderService implements BaseUploaderService {
  public upload(file: File): Observable<BaseUploaderOutput> {
    return of({
      file,
      progress: () => 0,
      complete: async () => {
        try {
          const mime = (file.type || '').toLowerCase();
          const rawExt = (file.name.split('.').pop() || '').toLowerCase();
          // Algunos pickers de Android entregan file.type vacío: sin este
          // fallback por extensión, un .mp4 entraría al pipeline de imagen
          // y moriría con "no pudimos leer esta imagen".
          const isVideo =
            mime.startsWith('video/') ||
            (mime === '' && ALLOWED_VIDEO_EXT.has(rawExt));
          const client = SupabaseClientProvider.getInstance();
          const baseName = file.name
            .replace(/\.[^.]+$/, '')
            .normalize('NFKD')
            .replace(/[^\w.-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 80);

          let body: Blob;
          let contentType: string;
          let ext: string;

          if (isVideo) {
            // Skip canvas compression — that pipeline only works for images.
            // Trust the file as-is; the form's accept list + size validator
            // already enforce mp4/webm under the per-product cap.
            body = file;
            contentType = file.type || VIDEO_MIME_BY_EXT[rawExt] || 'video/mp4';
            ext = ALLOWED_VIDEO_EXT.has(rawExt) ? rawExt : 'mp4';
          } else {
            let source: Blob = file;
            let decodeErrorMsg = MSG_UNREADABLE;
            if (await isHeicFile(file)) {
              const converted = await convertHeicToJpeg(file);
              if (converted) {
                source = converted;
              } else {
                // Conversión fallida: puede ser un JPEG renombrado a .heic
                // (decodifica nativo) o Safari 17+, que decodifica HEIC solo.
                // Probamos el decode nativo y solo si también falla mostramos
                // el mensaje específico de HEIC.
                decodeErrorMsg = MSG_HEIC;
              }
            }
            body = await this.compressImage(source, decodeErrorMsg);
            contentType = 'image/jpeg';
            ext = 'jpeg';
          }

          const path = `multimedia/${Date.now()}_${baseName}.${ext}`;

          const attempt = () =>
            client.storage
              .from('catalogohoy')
              .upload(path, body, { contentType });

          let { error } = await attempt();

          // "new row violates row-level security policy" en Storage casi
          // siempre significa que el access token EXPIRÓ y el request llegó
          // como anónimo (incidente drogueria-el-paisano 2026-07-21).
          // Refrescamos la sesión una vez y reintentamos; si persiste,
          // mensaje claro en vez del error crudo de RLS.
          if (error && /row-level security/i.test(error.message ?? '')) {
            await client.auth.refreshSession();
            ({ error } = await attempt());
            if (error && /row-level security/i.test(error.message ?? '')) {
              return E.left(
                new Error(
                  'Tu sesión expiró. Recarga la página e intenta de nuevo.'
                )
              );
            }
          }

          if (error) {
            const userMessage = error.message?.includes('Invalid key')
              ? 'El nombre del archivo contiene caracteres no permitidos. Renombra el archivo e intenta de nuevo.'
              : error.message;
            return E.left(new Error(userMessage));
          }

          const { data } = client.storage
            .from('catalogohoy')
            .getPublicUrl(path);
          return E.right(data.publicUrl);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          return E.left(new Error(message));
        }
      },
    });
  }

  private compressImage(file: Blob, decodeErrorMsg = MSG_UNREADABLE): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
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
                  new Error(
                    'No pudimos procesar esta imagen. Intenta con otra foto.'
                  )
                ),
          'image/jpeg',
          QUALITY
        );
      };
      img.onerror = () => reject(new Error(decodeErrorMsg));
      img.src = URL.createObjectURL(file);
    });
  }
}

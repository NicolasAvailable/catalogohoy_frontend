import { Injectable } from '@angular/core';
import { BaseUploaderOutput, E } from '@shared/domain';
import { Observable, of } from 'rxjs';
import { BaseUploaderService } from '../domain/uploader.service';
import { convertHeicToJpeg, isHeicFile } from './heic';
import { compressImage, preferredImageFormat, signedUpload } from './s3-storage';

// Las imágenes se re-encodean (WebP si el navegador puede, si no JPEG) vía
// canvas. Los videos conservan su extensión original para que el <video> del
// catálogo público elija el decoder correcto (mp4/webm).
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

          let body: Blob;
          let contentType: string;

          if (isVideo) {
            // Los videos no pasan por el canvas; se suben tal cual.
            body = file;
            contentType = file.type || VIDEO_MIME_BY_EXT[rawExt] || 'video/mp4';
          } else {
            let source: Blob = file;
            let decodeErrorMsg = MSG_UNREADABLE;
            if (await isHeicFile(file)) {
              const converted = await convertHeicToJpeg(file);
              if (converted) {
                source = converted;
              } else {
                decodeErrorMsg = MSG_HEIC;
              }
            }
            body = await compressImage(
              source,
              { maxWidth: 1200, quality: 0.8 },
              decodeErrorMsg
            );
            contentType = preferredImageFormat().mime;
          }

          const publicUrl = await signedUpload(body, file.name, contentType, 'product');
          return E.right(publicUrl);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          return E.left(new Error(message));
        }
      },
    });
  }
}

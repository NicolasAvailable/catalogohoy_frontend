import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { BaseUploaderOutput, E } from '@shared/domain';
import { Observable, of } from 'rxjs';
import { BaseUploaderService } from '../domain/uploader.service';

const MAX_WIDTH = 1200;
const QUALITY = 0.8;
// Images get a fixed extension because we always re-encode to JPEG via
// canvas. Videos keep their original extension so the browser knows the
// container format (mp4/webm) and the public catalog's <video> tag picks
// the right decoder.
const ALLOWED_VIDEO_EXT = new Set(['mp4', 'webm', 'ogg', 'ogv']);

@Injectable({ providedIn: 'root' })
export class UploaderService implements BaseUploaderService {
  public upload(file: File): Observable<BaseUploaderOutput> {
    return of({
      file,
      progress: () => 0,
      complete: async () => {
        try {
          const isVideo = (file.type || '').toLowerCase().startsWith('video/');
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
            contentType = file.type || 'video/mp4';
            const rawExt = (file.name.split('.').pop() || 'mp4').toLowerCase();
            ext = ALLOWED_VIDEO_EXT.has(rawExt) ? rawExt : 'mp4';
          } else {
            body = await this.compressImage(file);
            contentType = 'image/jpeg';
            ext = 'jpeg';
          }

          const path = `multimedia/${Date.now()}_${baseName}.${ext}`;

          const { error } = await client.storage
            .from('catalogohoy')
            .upload(path, body, { contentType });

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

  private compressImage(file: File): Promise<Blob> {
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
          (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
          'image/jpeg',
          QUALITY
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }
}

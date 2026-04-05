import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { BaseUploaderOutput, E } from '@shared/domain';
import { Observable, of } from 'rxjs';
import { BaseUploaderService } from '../domain/uploader.service';

const MAX_WIDTH = 1200;
const QUALITY = 0.8;

@Injectable({ providedIn: 'root' })
export class UploaderService implements BaseUploaderService {
  public upload(file: File): Observable<BaseUploaderOutput> {
    return of({
      file,
      progress: () => 0,
      complete: async () => {
        try {
          const client = SupabaseClientProvider.getInstance();
          const ext = file.name.split('.').pop() || 'jpg';
          const baseName = file.name
            .replace(/\.[^.]+$/, '')
            .normalize('NFKD')
            .replace(/[^\w.-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 80);
          const path = `multimedia/${Date.now()}_${baseName}.jpeg`;

          const compressed = await this.compressImage(file);

          const { error } = await client.storage
            .from('catalogohoy')
            .upload(path, compressed, { contentType: 'image/jpeg' });

          if (error) {
            const userMessage = error.message?.includes('Invalid key')
              ? 'El nombre del archivo contiene caracteres no permitidos. Renombra la imagen e intenta de nuevo.'
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

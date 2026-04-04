import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { BaseUploaderOutput, E } from '@shared/domain';
import { Observable, of } from 'rxjs';
import { BaseUploaderService } from '../domain/uploader.service';

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
          const path = `multimedia/${Date.now()}_${baseName}.${ext}`;
          const { error } = await client.storage
            .from('catalogohoy')
            .upload(path, file);

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
}

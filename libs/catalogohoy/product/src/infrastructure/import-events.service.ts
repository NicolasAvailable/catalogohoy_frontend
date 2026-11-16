import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { signedUpload } from '@ui';

/** Telemetría de soporte del hub de import: avisa a Slack (edge function
 *  `notify-import-event`) cuando un import falla o un PDF se importa bien.
 *  La edge function además deja traza en la tabla `catalog_imports`; para
 *  poder reproducir el caso, el archivo fuente del import (Excel/PDF) se
 *  registra acá y se sube al bucket (imports/<slug>/…) recién cuando un
 *  evento lo necesita — un import sin eventos no sube nada.
 *  Fire-and-forget: jamás bloquea ni rompe el flujo del cliente. */
@Injectable({ providedIn: 'root' })
export class ImportEventsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Archivo fuente del import en curso (lo setea el hub al seleccionarlo). */
  private pendingFile: File | null = null;
  /** Upload en curso/completado del archivo pendiente (compartido entre
   *  notifies del mismo import para subirlo una sola vez). */
  private uploadPromise: Promise<{ name: string; url: string | null }> | null =
    null;

  /** Registra el archivo fuente del import actual (Excel/PDF). */
  public registerFile(file: File): void {
    this.pendingFile = file;
    this.uploadPromise = null;
  }

  public notify(
    event: string,
    detail?: string,
    counts?: { pages?: number; products?: number }
  ): void {
    try {
      const slug = localStorage.getItem('slug') ?? '';
      const upload = this.ensureUploaded(slug);
      void (async () => {
        const file = await upload;
        await this.client.functions
          .invoke('notify-import-event', {
            body: {
              event,
              detail,
              slug,
              fileName: file?.name,
              fileUrl: file?.url,
              pages: counts?.pages,
              products: counts?.products,
            },
          })
          .catch(() => undefined);
      })().catch(() => undefined);
    } catch {
      // Telemetría best-effort: cualquier fallo se ignora.
    }
  }

  /** Sube el archivo registrado al bucket la primera vez que un evento lo
   *  necesita. Best-effort: si falla, el evento sale sin archivo. */
  private ensureUploaded(
    slug: string
  ): Promise<{ name: string; url: string | null } | null> {
    if (this.uploadPromise) return this.uploadPromise;
    const file = this.pendingFile;
    if (!file) return Promise.resolve(null);

    this.uploadPromise = signedUpload(
      file,
      file.name,
      file.type || 'application/octet-stream',
      'import',
      undefined,
      slug
    )
      .then((url) => ({ name: file.name, url }))
      .catch(() => ({ name: file.name, url: null }));
    return this.uploadPromise;
  }
}

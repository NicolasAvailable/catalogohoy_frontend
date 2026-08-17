import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';

/** Telemetría de soporte del hub de import: avisa a Slack (edge function
 *  `notify-import-event`) cuando un import falla o un PDF se importa bien.
 *  Fire-and-forget: jamás bloquea ni rompe el flujo del cliente. */
@Injectable({ providedIn: 'root' })
export class ImportEventsService {
  private readonly client = SupabaseClientProvider.getInstance();

  public notify(event: string, detail?: string): void {
    try {
      const slug = localStorage.getItem('slug') ?? '';
      void this.client.functions
        .invoke('notify-import-event', { body: { event, detail, slug } })
        .catch(() => undefined);
    } catch {
      // Telemetría best-effort: cualquier fallo se ignora.
    }
  }
}

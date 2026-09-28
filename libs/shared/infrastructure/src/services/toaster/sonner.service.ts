import { Injectable } from '@angular/core';
import { Exception } from '@shared/domain';
import { TranslateService } from '@shared/presenter';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class SonnerToasterService {
  private waitId: string | number | undefined = undefined;

  constructor(private readonly translate: TranslateService) {}

  public success(message: string) {
    // Cualquier toast de resultado cierra el de espera pendiente (si lo hay),
    // así nunca quedan apilados un "cargando…" y un "éxito/error".
    this.dismissWait();
    toast.success(this.translate.translate(message));
  }

  public error(exception: Exception) {
    this.dismissWait();
    toast.error(this.translate.translate(exception.message, exception.params));
  }

  public warning(message: string) {
    this.dismissWait();
    toast.warning(this.translate.translate(message));
  }

  public info(message: string) {
    this.dismissWait();
    toast.info(this.translate.translate(message));
  }

  /**
   * Aviso in-app enriquecido para eventos del sistema (p. ej. una orden nueva):
   * título traducido + descripción libre (que NO se traduce, suele ser dato del
   * cliente) + una acción opcional. Dura más que un toast normal para dar tiempo
   * a reaccionar.
   */
  public notify(
    titleKey: string,
    options?: { description?: string; actionKey?: string; onAction?: () => void }
  ) {
    this.dismissWait();
    toast.success(this.translate.translate(titleKey), {
      description: options?.description,
      duration: 8000,
      action:
        options?.actionKey && options?.onAction
          ? {
              label: this.translate.translate(options.actionKey),
              onClick: options.onAction,
            }
          : undefined,
    });
  }

  public wait(message: string) {
    // duration: Infinity → el toast de espera NO se auto-cierra; persiste hasta
    // que la acción termine (dismissWait) o lo reemplace un toast de resultado.
    this.waitId = toast.loading(this.translate.translate(message), {
      duration: Infinity,
    });
  }

  public dismissWait() {
    toast.dismiss(this.waitId);
  }
}

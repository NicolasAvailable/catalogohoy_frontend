import { Injectable } from '@angular/core';
import { Exception } from '@shared/domain';
import { TranslateService } from '@shared/presenter';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class SonnerToasterService {
  /** Id FIJO del toast de espera. Al reusar siempre el mismo id, ngx-sonner
   *  ACTUALIZA el toast existente en vez de apilar uno nuevo: por más rápido
   *  que se dispare `wait()` (p. ej. subir/quitar imágenes seguido) nunca
   *  quedan varios "cargando…" huérfanos, y `dismissWait()` siempre lo cierra.
   *  (Antes se guardaba el id dinámico de cada `toast.loading`, que se
   *  sobreescribía sin cerrar el anterior → toasts pegados con duration:∞.) */
  private static readonly WAIT_ID = 'app-wait-toast';

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
    // id fijo → si ya hay uno de espera, se ACTUALIZA (no se apila otro).
    toast.loading(this.translate.translate(message), {
      id: SonnerToasterService.WAIT_ID,
      duration: Infinity,
    });
  }

  public dismissWait() {
    // Cierra SOLO el toast de espera por su id fijo. (Con `dismiss(undefined)`
    // ngx-sonner cerraba TODOS los toasts; con el id fijo es un no-op si no hay.)
    toast.dismiss(SonnerToasterService.WAIT_ID);
  }
}

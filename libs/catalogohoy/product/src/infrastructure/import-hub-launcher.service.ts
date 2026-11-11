import { Injectable, signal } from '@angular/core';

/** Abre el hub de importar/exportar productos. El hub vive en el layout del
 *  admin (no en la vista de Productos) para que un import siga corriendo en
 *  segundo plano mientras el usuario navega por la app. Se carga con @defer
 *  la primera vez que se pide (trae xlsx/pdf.js). */
@Injectable({ providedIn: 'root' })
export class ImportHubLauncher {
  /** true desde el primer pedido: dispara el @defer del layout. */
  public readonly requested = signal(false);
  private opener: (() => void) | null = null;
  private pendingOpen = false;

  public open(): void {
    this.requested.set(true);
    if (this.opener) this.opener();
    else this.pendingOpen = true;
  }

  /** Lo llama el hub al montarse. */
  public register(opener: () => void): void {
    this.opener = opener;
    if (this.pendingOpen) {
      this.pendingOpen = false;
      opener();
    }
  }

  public unregister(): void {
    this.opener = null;
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppUpdateService, isNativeApp, UpdateStatus } from '@catalogohoy/core';
import { IconComponent } from '@ui';

const DISMISS_KEY = 'app_update_dismissed_build';

/**
 * Modal app-wide de "nueva versión disponible" para la app nativa. Se monta en
 * el root (app.html). Chequea `mobile_app_config` al arrancar:
 *  - update OBLIGATORIO (`required`): modal NO cerrable (bugs críticos) → solo
 *    "Actualizar ahora".
 *  - update opcional (`available`): cerrable con "Ahora no", y se recuerda el
 *    descarte por `latestBuild` (no vuelve a molestar hasta el próximo release).
 * En web es no-op (no renderiza nada).
 */
@Component({
  selector: 'app-update-gate',
  standalone: true,
  imports: [TranslocoPipe, IconComponent],
  templateUrl: './app-update-gate.html',
})
export class AppUpdateGate {
  private readonly updateService = inject(AppUpdateService);

  protected readonly status = signal<UpdateStatus | null>(null);
  protected readonly visible = signal(false);

  /** true = no se puede cerrar (actualización obligatoria). */
  protected readonly required = computed(() => this.status()?.required ?? false);

  /** Título/mensaje: usa el custom de la DB si existe; si no, el default i18n. */
  protected readonly titleKey = computed(() =>
    this.status()?.title
      ? ''
      : this.required()
        ? 'Actualización necesaria'
        : 'Actualización disponible'
  );
  protected readonly messageKey = computed(() =>
    this.status()?.message
      ? ''
      : this.required()
        ? 'Necesitas actualizar a la última versión para seguir usando la app.'
        : 'Hay una nueva versión de la app con mejoras y correcciones.'
  );

  constructor() {
    // En el preview del onboarding/editor (iframe `?preview=true`) no hay bridge
    // nativo → no chequeamos actualización ahí (evita tocar @capacitor/app).
    const isPreview =
      new URLSearchParams(window.location.search).get('preview') === 'true';
    if (isNativeApp() && !isPreview) void this.run();
  }

  private async run(): Promise<void> {
    const status = await this.updateService.check();
    if (!status) return;
    if (status.required) {
      this.status.set(status);
      this.visible.set(true);
      return;
    }
    if (status.available && !this.wasDismissed(status.latestBuild)) {
      this.status.set(status);
      this.visible.set(true);
    }
  }

  protected update(): void {
    const url = this.status()?.storeUrl;
    if (url) this.updateService.openStore(url);
  }

  /** "Ahora no" (solo updates opcionales): oculta y recuerda el descarte. */
  protected dismiss(): void {
    if (this.required()) return;
    const build = this.status()?.latestBuild;
    if (build != null) {
      try {
        localStorage.setItem(DISMISS_KEY, String(build));
      } catch {
        /* private mode: no pasa nada, vuelve a aparecer al reabrir */
      }
    }
    this.visible.set(false);
  }

  private wasDismissed(latestBuild: number): boolean {
    try {
      return Number(localStorage.getItem(DISMISS_KEY)) >= latestBuild;
    } catch {
      return false;
    }
  }
}

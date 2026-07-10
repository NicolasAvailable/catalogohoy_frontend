import { Injectable, signal } from '@angular/core';
import { isDevMode } from '../../constants';

/** Detecta proactivamente deploys nuevos: compara el bundle `main-*.js` con
 *  el que se cargó esta sesión, re-fetcheando el index.html (no-store) cada
 *  POLL_MS y al volver a la pestaña. Complementa al ChunkAwareErrorHandler
 *  (que recarga *reactivamente* cuando un chunk viejo ya falló). */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private static readonly POLL_MS = 5 * 60 * 1000;
  private static readonly MAIN_BUNDLE_RE = /main-[A-Z0-9]+\.js/;
  /** Demo/QA: fuerza el banner sin esperar un deploy. En el admin basta
   *  visitar /admin?__update_banner_demo=1 (AppComponent lo persiste a
   *  localStorage). Descartar el banner limpia el flag. */
  private static readonly DEMO_FLAG = '__update_banner_demo';

  /** Bundle con el que se cargó esta sesión. */
  private currentVersion: string | null = null;
  /** Último bundle visto en el server (para no re-mostrar tras descartar). */
  private latestSeen: string | null = null;
  private dismissedVersion: string | null = null;
  private pollId: ReturnType<typeof setInterval> | null = null;

  public readonly updateAvailable = signal(false);

  /** Idempotente: el banner lo llama desde su constructor. */
  public startWatching(): void {
    if (localStorage.getItem(AppVersionService.DEMO_FLAG) === '1') {
      this.updateAvailable.set(true);
      return;
    }
    if (isDevMode() || this.pollId) return;

    this.currentVersion = this.readCurrentVersion();
    // Sin bundle fingerprinteado (dev server / build raro) no hay qué comparar.
    if (!this.currentVersion) return;

    this.pollId = setInterval(() => this.check(), AppVersionService.POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.check();
    });
  }

  public dismiss(): void {
    localStorage.removeItem(AppVersionService.DEMO_FLAG);
    this.dismissedVersion = this.latestSeen;
    this.updateAvailable.set(false);
  }

  public reload(): void {
    window.location.reload();
  }

  private readCurrentVersion(): string | null {
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="main-"]'
    );
    return script?.src.match(AppVersionService.MAIN_BUNDLE_RE)?.[0] ?? null;
  }

  private async check(): Promise<void> {
    try {
      const res = await fetch('/', { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.text();
      const latest = html.match(AppVersionService.MAIN_BUNDLE_RE)?.[0];
      if (!latest) return;

      this.latestSeen = latest;
      if (latest !== this.currentVersion && latest !== this.dismissedVersion) {
        this.updateAvailable.set(true);
      }
    } catch {
      // Offline / error transitorio: el próximo poll reintenta.
    }
  }
}

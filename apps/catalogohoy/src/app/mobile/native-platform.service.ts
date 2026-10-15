import { Injectable } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Inicialización del shell nativo (Capacitor). En web todos los métodos son
 * no-ops, así que es seguro invocarlo siempre desde el arranque de la app.
 *
 * Ojo: NO hace routing. El entry-point nativo (login → slug → /admin) se
 * resuelve en la Fase 1 porque `/admin` está gateado por `isValidSlugGuard`.
 */
@Injectable({ providedIn: 'root' })
export class NativePlatformService {
  /** true dentro de la app iOS/Android; false en el navegador. */
  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  get platform(): 'ios' | 'android' | 'web' {
    return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
  }

  /** true dentro del iframe de preview (onboarding/editor, `?preview=true`):
   *  ahí NO hay bridge nativo, así que no se deben tocar plugins de Capacitor. */
  isPreview(): boolean {
    try {
      return new URLSearchParams(window.location.search).get('preview') === 'true';
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    if (!this.isNative) return;

    // Preview del onboarding/editor (iframe con `?preview=true`): el bridge
    // nativo de Capacitor NO está wireado en el sub-frame → cualquier llamada a
    // un plugin tira "plugin not implemented on ios/android". El preview solo
    // renderiza un storefront, así que NO inicializamos el shell nativo acá.
    if (this.isPreview()) return;

    // Marca el documento como app nativa → habilita reglas CSS que anulan el
    // rebote elástico del WKWebView y fijan la barra superior (ver styles.css).
    document.documentElement.classList.add('native-app');

    try {
      await StatusBar.setStyle({ style: Style.Default });
      if (this.platform === 'android') {
        // La status bar no se superpone al contenido (lo maneja safe-area CSS).
        await StatusBar.setOverlaysWebView({ overlay: false });
      }
    } catch {
      /* plugin no disponible en esta plataforma */
    }

    // Botón "atrás" físico: SOLO Android (iOS no tiene botón físico; llamar al
    // plugin ahí tira "not implemented on ios"). Envuelto por si el bridge aún
    // no está listo.
    if (this.platform === 'android') {
      try {
        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            void CapacitorApp.minimizeApp();
          }
        });
      } catch {
        /* noop */
      }
    }

    // Angular ya montó → escondemos el splash nativo.
    try {
      await SplashScreen.hide();
    } catch {
      /* noop */
    }
  }
}

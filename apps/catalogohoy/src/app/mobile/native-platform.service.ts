import { Injectable } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
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
    // Un sub-frame (iframe de vista previa del catálogo) nunca es "la app".
    return Capacitor.isNativePlatform() && window.self === window.top;
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
    // Clase por plataforma (p.ej. en Android las barras del sistema NO se
    // superponen a la app, así que no hay safe-area que compensar).
    document.documentElement.classList.add(`native-${this.platform}`);

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

    // Teclado: en NINGUNA plataforma redimensionamos la pantalla al abrirlo.
    // Con el redimensionado, las tablas que llenan el alto (clientes,
    // productos, órdenes) y el login se re-acomodaban de golpe al tocar un
    // campo. El teclado simplemente se superpone:
    //  · iOS: `Keyboard.setResizeMode(None)`.
    //  · Android: `windowSoftInputMode="adjustNothing"` en el AndroidManifest.
    // Como ya nada se mueve solo, `keepFocusedFieldVisible` sube a la vista el
    // campo enfocado cuando quedaría tapado por el teclado.
    try {
      if (this.platform === 'ios') {
        await Keyboard.setResizeMode({ mode: KeyboardResize.None });
      }
    } catch {
      /* plugin no disponible */
    }
    this.keepFocusedFieldVisible();

    // Angular ya montó → escondemos el splash nativo.
    try {
      await SplashScreen.hide();
    } catch {
      /* noop */
    }
  }

  /** Con el teclado superpuesto (sin redimensionar), un campo en la mitad de
   *  abajo de la pantalla quedaría tapado. Al enfocarlo, le damos aire al
   *  contenedor con scroll más cercano y lo subimos al tercio superior; al
   *  salir del campo se quita ese aire. Los campos de la mitad de arriba
   *  (buscadores, login) no se tocan, así que ahí nada se mueve. */
  private keepFocusedFieldVisible(): void {
    const FIELD =
      'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, [contenteditable="true"]';
    let padded: HTMLElement | null = null;
    let previous = '';
    const restore = (): void => {
      if (!padded) return;
      padded.style.paddingBottom = previous;
      padded = null;
    };

    document.addEventListener('focusin', (event) => {
      const el = event.target as HTMLElement | null;
      if (!el?.matches?.(FIELD)) return;
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= window.innerHeight * 0.5) return;
        let scroller = el.parentElement;
        while (scroller) {
          if (/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) break;
          scroller = scroller.parentElement;
        }
        if (!scroller) return;
        if (padded !== scroller) {
          restore();
          padded = scroller;
          previous = scroller.style.paddingBottom;
          scroller.style.paddingBottom = '55vh';
        }
        scroller.scrollBy({
          top: rect.top - window.innerHeight * 0.2,
          behavior: 'smooth',
        });
      }, 60);
    });

    document.addEventListener('focusout', () => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active?.matches?.(FIELD)) restore();
      }, 120);
    });
  }
}

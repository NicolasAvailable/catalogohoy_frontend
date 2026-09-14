import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { isNativeApp } from '@catalogohoy/core';
import { Observable, of } from 'rxjs';

/**
 * En la app NATIVA precargamos TODOS los lazy chunks en segundo plano (son
 * locales, `capacitor://localhost` → sin costo de red) para que el cambio entre
 * secciones sea instantáneo (no se carga/parsea el chunk recién al entrar).
 *
 * En WEB no precarga nada (equivalente a NoPreloading): así no inflamos la
 * descarga inicial del storefront/admin en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class NativePreloadStrategy implements PreloadingStrategy {
  preload(_route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return isNativeApp() ? load() : of(null);
  }
}

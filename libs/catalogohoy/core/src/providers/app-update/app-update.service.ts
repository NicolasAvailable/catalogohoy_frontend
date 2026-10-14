import { Injectable } from '@angular/core';
import { isAndroidApp, isNativeApp } from '../../constants/tenant.constant';
import { SupabaseClientProvider } from '../supabase/supabase';

/** Resultado del chequeo de versión contra `mobile_app_config`. */
export interface UpdateStatus {
  /** El build actual está por debajo de `min_build` → update OBLIGATORIO. */
  required: boolean;
  /** El build actual está por debajo de `latest_build` → update opcional. */
  available: boolean;
  /** Build mínimo/último para cachear la decisión de "no mostrar de nuevo". */
  latestBuild: number;
  storeUrl: string;
  latestVersion: string | null;
  /** Textos custom por release (si se setearon en la DB); si no, null. */
  title: string | null;
  message: string | null;
}

interface ConfigRow {
  latest_build: number;
  min_build: number;
  latest_version: string | null;
  store_url: string;
  update_title: string | null;
  update_message: string | null;
}

/**
 * Chequea si hay una nueva versión de la app nativa disponible comparando el
 * build instalado (`App.getInfo().build` = versionCode en Android /
 * CFBundleVersion en iOS) contra la tabla `mobile_app_config` (una fila por
 * plataforma). NO decide la UI: solo informa `required`/`available`; el modal
 * (`AppUpdateGate`) decide si se puede cerrar. En web es no-op.
 *
 * Backend-driven a propósito: subís un build nuevo y actualizás la fila
 * (`latest_build`, y `min_build` para forzar en bugs críticos) sin recompilar.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  async check(): Promise<UpdateStatus | null> {
    if (!isNativeApp()) return null;
    try {
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      const currentBuild = parseInt(info.build, 10);
      if (!Number.isFinite(currentBuild)) return null;

      const platform = isAndroidApp() ? 'android' : 'ios';
      const { data, error } = await SupabaseClientProvider.getInstance()
        .from('mobile_app_config')
        .select(
          'latest_build, min_build, latest_version, store_url, update_title, update_message'
        )
        .eq('platform', platform)
        .single<ConfigRow>();
      if (error || !data) return null;

      const latestBuild = Number(data.latest_build);
      const minBuild = Number(data.min_build);
      return {
        required: currentBuild < minBuild,
        available: currentBuild < latestBuild,
        latestBuild,
        storeUrl: data.store_url,
        latestVersion: data.latest_version ?? null,
        title: data.update_title ?? null,
        message: data.update_message ?? null,
      };
    } catch {
      // Red caída / plugin ausente: nunca bloqueamos la app por el chequeo.
      return null;
    }
  }

  /** Abre la ficha de la app en la tienda (Play / App Store). */
  openStore(url: string): void {
    try {
      window.open(url, '_blank');
    } catch {
      /* noop */
    }
  }
}

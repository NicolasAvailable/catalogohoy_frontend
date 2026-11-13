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
 * La versión "última" sale sola de la tienda: la edge fn `mobile-app-version`
 * lee la versión PUBLICADA en App Store / Google Play, así el aviso aparece en
 * cada release (cuando ya se puede descargar) sin tocar nada a mano. La tabla
 * queda para forzar un update (`min_build`), para textos custom y como
 * respaldo si la tienda no responde (`latest_build`).
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
      const supabase = SupabaseClientProvider.getInstance();
      const [config, store] = await Promise.all([
        supabase
          .from('mobile_app_config')
          .select(
            'latest_build, min_build, latest_version, store_url, update_title, update_message'
          )
          .eq('platform', platform)
          .single<ConfigRow>(),
        this.storeVersion(platform),
      ]);
      const data = config.data;
      if (!data && !store) return null;

      const latestBuild = Number(data?.latest_build ?? 0);
      const minBuild = Number(data?.min_build ?? 0);
      // Versión publicada en la tienda vs la instalada. Si la tienda no
      // respondió, respaldo por build contra la tabla.
      const available = store?.latestVersion
        ? compareVersions(info.version, store.latestVersion) < 0
        : currentBuild < latestBuild;
      const latestVersion = store?.latestVersion ?? data?.latest_version ?? null;
      return {
        required: currentBuild < minBuild,
        available,
        latestBuild,
        storeUrl: store?.storeUrl ?? data?.store_url ?? '',
        latestVersion,
        title: data?.update_title ?? null,
        message: data?.update_message ?? null,
      };
    } catch {
      // Red caída / plugin ausente: nunca bloqueamos la app por el chequeo.
      return null;
    }
  }

  /** Versión en vivo en la tienda (edge fn). null si no se pudo consultar. */
  private async storeVersion(
    platform: 'ios' | 'android'
  ): Promise<{ latestVersion: string | null; storeUrl: string } | null> {
    try {
      const { data, error } = await SupabaseClientProvider.getInstance().functions.invoke<{
        latestVersion: string | null;
        storeUrl: string;
      }>('mobile-app-version', { body: { platform } });
      if (error || !data) return null;
      return data;
    } catch {
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

/** Compara versiones tipo "1.0.9" vs "1.0.10": <0 si `a` es menor que `b`. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

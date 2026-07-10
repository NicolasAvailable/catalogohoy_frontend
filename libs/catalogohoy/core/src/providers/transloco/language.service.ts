import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { PrimeNG } from 'primeng/config';
import { PRIMENG_TRANSLATIONS } from '../primeng/primeng.i18n';
import { SupabaseClientProvider } from '../supabase/supabase';
import {
  APP_LANGUAGES,
  AppLanguage,
  CATALOG_LANGUAGE_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  resolveInitialLanguage,
} from './language.const';

/**
 * Idioma de la plataforma (es/en/fr/pt). Cambiarlo re-renderiza todos los
 * textos de Transloco en vivo y actualiza los internos de PrimeNG.
 * Los formatos de fecha/número (LOCALE_ID) se resuelven al bootstrap con el
 * mismo idioma guardado, así que quedan alineados en la próxima carga.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly primeng = inject(PrimeNG);

  public readonly languages = APP_LANGUAGES;
  public readonly current = signal<AppLanguage>(resolveInitialLanguage());

  /** True si el usuario tocó el selector en ESTA visita (no un valor viejo
   *  de localStorage) — regula qué puede pisar al perfil en flushToProfile. */
  private changedThisSession = false;

  /** Aplica el idioma inicial; lo llama el app initializer de transloco. */
  public init(): void {
    this.apply(this.current());
    this.syncFromProfile();
  }

  public set(lang: AppLanguage): void {
    if (lang === this.current()) return;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // sin persistencia: el cambio vale solo para esta sesión
    }
    this.current.set(lang);
    this.apply(lang);
    this.changedThisSession = true;
    void this.persistToProfile(lang);
  }

  /** Empuja el idioma actual al perfil apenas EXISTE sesión (post-login):
   *  en el login no hay usuario, así que la elección solo vive en el
   *  localStorage de auth.catalogohoy.com (otro origen que el admin); este
   *  flush la hace viajar por la cuenta. Regla anti-pisadas: solo escribe si
   *  el usuario eligió en esta visita, o si el perfil aún no tiene idioma. */
  public async flushToProfile(): Promise<void> {
    try {
      const client = SupabaseClientProvider.getInstance();
      if (this.changedThisSession) {
        await this.persistToProfile(this.current());
        return;
      }
      const { data } = await client.auth.getUser();
      if (!data.user?.user_metadata?.['language']) {
        await this.persistToProfile(this.current());
      }
    } catch {
      // sin sesión/cliente: no hay perfil al que empujar
    }
  }

  /** Elección del visitante en el catálogo público: persiste en su propia
   *  llave (no pisa la preferencia del panel) y aplica en vivo. */
  public setCatalog(lang: AppLanguage): void {
    try {
      localStorage.setItem(CATALOG_LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // sin persistencia: el cambio vale solo para esta sesión
    }
    this.setSession(lang);
  }

  /** Idioma que el visitante eligió en el catálogo (null si nunca eligió). */
  public getStoredCatalogLanguage(): AppLanguage | null {
    try {
      const stored = localStorage.getItem(CATALOG_LANGUAGE_STORAGE_KEY);
      return APP_LANGUAGES.some((l) => l.code === stored)
        ? (stored as AppLanguage)
        : null;
    } catch {
      return null;
    }
  }

  /** Aplica un idioma SOLO para esta sesión, sin persistir la elección.
   *  Lo usa el storefront para el idioma default del tenant: si el visitante
   *  después elige uno con el switcher (set), esa elección sí manda. */
  public setSession(lang: AppLanguage): void {
    if (!APP_LANGUAGES.some((l) => l.code === lang) || lang === this.current())
      return;
    this.current.set(lang);
    this.apply(lang);
  }

  /** Persiste la preferencia en el perfil del usuario (user_metadata de
   *  Supabase Auth): así viaja con la CUENTA y no con el navegador — otros
   *  dispositivos y las futuras apps móviles la comparten con el mismo login.
   *  Best-effort: sin sesión (catálogo público, login) no hace nada. */
  private async persistToProfile(lang: AppLanguage): Promise<void> {
    try {
      const client = SupabaseClientProvider.getInstance();
      await client.auth.updateUser({ data: { language: lang } });
    } catch {
      // sin cliente/sesión: queda solo en localStorage
    }
  }

  /** Al iniciar, si el perfil trae un idioma distinto (elegido en otro
   *  dispositivo/app), gana el del perfil. Corre diferido para no bloquear
   *  el bootstrap y dar tiempo a que la sesión esté disponible. */
  private syncFromProfile(): void {
    setTimeout(async () => {
      try {
        const client = SupabaseClientProvider.getInstance();
        const { data } = await client.auth.getUser();
        const profileLang = data.user?.user_metadata?.['language'] as
          | AppLanguage
          | undefined;
        if (
          profileLang &&
          APP_LANGUAGES.some((l) => l.code === profileLang) &&
          profileLang !== this.current()
        ) {
          try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, profileLang);
          } catch {
            // sin persistencia local: igual aplicamos
          }
          this.current.set(profileLang);
          this.apply(profileLang);
        }
      } catch {
        // sin sesión (storefront público / login): nada que sincronizar
      }
    }, 1500);
  }

  private apply(lang: AppLanguage): void {
    this.transloco.setActiveLang(lang);
    this.primeng.setTranslation(PRIMENG_TRANSLATIONS[lang]);
  }
}

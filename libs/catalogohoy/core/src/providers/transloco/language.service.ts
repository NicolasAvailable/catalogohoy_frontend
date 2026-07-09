import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { PrimeNG } from 'primeng/config';
import { PRIMENG_TRANSLATIONS } from '../primeng/primeng.i18n';
import {
  APP_LANGUAGES,
  AppLanguage,
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

  /** Aplica el idioma inicial; lo llama el app initializer de transloco. */
  public init(): void {
    this.apply(this.current());
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
  }

  private apply(lang: AppLanguage): void {
    this.transloco.setActiveLang(lang);
    this.primeng.setTranslation(PRIMENG_TRANSLATIONS[lang]);
  }
}

import {
  EnvironmentProviders,
  inject,
  isDevMode,
  provideAppInitializer,
  Provider,
} from '@angular/core';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { APP_LANGUAGES } from './language.const';
import { LanguageService } from './language.service';
import { TranslocoHttpLoader } from './transloco.http-loader';

export const provideTranslation = (): Array<
  Provider | EnvironmentProviders
> => {
  const providers: Array<Provider | EnvironmentProviders> = [
    provideTransloco({
      config: {
        availableLangs: APP_LANGUAGES.map((l) => l.code),
        defaultLang: 'es',
        // La convención es key-as-text (la key ES el texto en español), así
        // que una key faltante devuelve español por construcción; el fallback
        // queda como red de seguridad.
        fallbackLang: 'es',
        reRenderOnLangChange: true,
        // Llaves SIMPLES para parámetros ('Vence en {days} días'): con las
        // {{ }} default, una key con parámetros rompería el parser de
        // templates de Angular al usarla inline con el pipe.
        interpolation: ['{', '}'],
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      const initializerFn = (() => {
        const language = inject(LanguageService);
        const translocoService = inject(TranslocoService);
        // Aplica idioma guardado/navegador y sincroniza PrimeNG.
        language.init();
        return () =>
          firstValueFrom(translocoService.load(language.current()), {
            defaultValue: {},
          });
      })();
      return initializerFn();
    }),
  ];

  return providers;
};

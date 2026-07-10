export type AppLanguage = 'es' | 'en' | 'fr' | 'pt';

export const APP_LANGUAGES: ReadonlyArray<{
  code: AppLanguage;
  label: string;
  /** Bandera circular (SVG local, set open-source circle-flags). Los assets
   *  viven en public/images/flags/ de cada app que usa el selector. */
  flag: string;
}> = [
  { code: 'es', label: 'Español', flag: '/images/flags/es.svg' },
  { code: 'en', label: 'English', flag: '/images/flags/us.svg' },
  { code: 'fr', label: 'Français', flag: '/images/flags/fr.svg' },
  { code: 'pt', label: 'Português', flag: '/images/flags/br.svg' },
];

export const LANGUAGE_STORAGE_KEY = 'catalogohoy_lang';

/** Elección de idioma del VISITANTE en el catálogo público. Separada de la
 *  del panel: el admin y el storefront comparten origen/localStorage, y sin
 *  esto la preferencia del panel del comerciante pisaba el idioma default
 *  del catálogo en su propio navegador. */
export const CATALOG_LANGUAGE_STORAGE_KEY = 'catalogohoy_catalog_lang';

const CODES: string[] = APP_LANGUAGES.map((l) => l.code);

/**
 * Idioma inicial: elección guardada > idioma del navegador > español.
 * Función pura (sin DI) porque también la usa el factory de LOCALE_ID,
 * que se resuelve antes de que exista cualquier servicio.
 */
export function resolveInitialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && CODES.includes(stored)) return stored as AppLanguage;
  } catch {
    // localStorage bloqueado (modo privado, etc.) → decide el navegador
  }
  const browser = (navigator.language ?? '').slice(0, 2).toLowerCase();
  return CODES.includes(browser) ? (browser as AppLanguage) : 'es';
}

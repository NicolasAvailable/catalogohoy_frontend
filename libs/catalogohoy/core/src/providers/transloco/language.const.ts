export type AppLanguage = 'es' | 'en' | 'fr' | 'pt';

export const APP_LANGUAGES: ReadonlyArray<{
  code: AppLanguage;
  label: string;
}> = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
];

export const LANGUAGE_STORAGE_KEY = 'catalogohoy_lang';

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

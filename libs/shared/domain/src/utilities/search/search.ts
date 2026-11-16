// Búsqueda tolerante para filtrar productos con PostgREST (`~*` / imatch).
//
// Un ILIKE '%carcasa%' no encuentra "CARCAZA", ni "cafe" encuentra "Café", ni
// "faro carcasa" encuentra "CARCASA FARO". Acá el término se parte en palabras
// y cada palabra se convierte en una regex que acepta acentos, s/z/c suave y
// b/v. Cada palabra se aplica como un filtro aparte (AND), en cualquier orden.

const ACCENTS: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a', ã: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o', õ: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
  ñ: 'n', ç: 'c',
};

const CHAR_CLASS: Record<string, string> = {
  a: '[aáàäâã]',
  e: '[eéèëê]',
  i: '[iíìïî]',
  o: '[oóòöôõ]',
  u: '[uúùüû]',
  n: '[nñ]',
  b: '[bv]',
  // "s" suena igual que "z" y que "c" antes de e/i.
  s: '(?:[szç]|c(?=[eéèëêiíìïî]))',
};

/** Minúsculas, sin acentos, z→s, ce/ci→se/si, v→b, símbolos → espacio. */
export function normalizeSearchText(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[áàäâãéèëêíìïîóòöôõúùüûñç]/g, (ch) => ACCENTS[ch] ?? ch)
    .replace(/z/g, 's')
    .replace(/c(?=[ei])/g, 's')
    .replace(/v/g, 'b')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Palabras normalizadas del término (solo [a-z0-9], sin vacíos). */
export function searchWords(term: string): string[] {
  return normalizeSearchText(term).split(' ').filter(Boolean);
}

/** Regex POSIX (Postgres `~*`) tolerante para una palabra ya normalizada. */
export function searchWordPattern(word: string): string {
  return [...word].map((ch) => CHAR_CLASS[ch] ?? ch).join('');
}

/** Una regex por palabra del término; aplicar cada una con `.filter(col, 'imatch', p)`. */
export function searchPatterns(term: string): string[] {
  return searchWords(term).map(searchWordPattern);
}

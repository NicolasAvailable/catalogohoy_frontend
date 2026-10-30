import { normalizeSearchText, searchPatterns } from '../../search/search';

const matches = (term: string, text: string) =>
  searchPatterns(term).every((p) => new RegExp(p, 'i').test(text));

describe('search', () => {
  it('normaliza acentos, s/z/c y b/v', () => {
    expect(normalizeSearchText('Carcaza Café Cerveza')).toBe('carcasa cafe serbesa');
  });

  it('encuentra variantes de escritura', () => {
    expect(matches('carcasa', 'CARCAZA TACOMETRO CG150-M')).toBe(true);
    expect(matches('cafe', 'Café Incasa 100gr')).toBe(true);
    expect(matches('faro carcasa', 'CARCASA FARO EK-XX')).toBe(true);
    expect(matches('ek-xx', 'CARCASA FARO EK-XX')).toBe(true);
    expect(matches('carcasa', 'Casaca Tommy')).toBe(false);
  });

  it('ignora términos sin letras ni números', () => {
    expect(searchPatterns('  - ')).toEqual([]);
  });
});

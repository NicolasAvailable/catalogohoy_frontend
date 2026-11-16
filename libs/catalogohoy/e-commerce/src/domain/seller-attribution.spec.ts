import { readStoredSellerSlug, sellerSlugFromUrl, storeSellerSlug } from './seller-attribution';

describe('seller-attribution', () => {
  it('lee el slug de /v/<slug> o ?v=', () => {
    expect(sellerSlugFromUrl('https://tienda.catalogohoy.com/v/juan')).toBe('juan');
    expect(sellerSlugFromUrl('https://tienda.catalogohoy.com/v/Juan-Perez/')).toBe('juan-perez');
    expect(sellerSlugFromUrl('http://localhost:4200/v/ana?slug=demo')).toBe('ana');
    expect(sellerSlugFromUrl('https://tienda.catalogohoy.com/?v=ana')).toBe('ana');
    expect(sellerSlugFromUrl('https://tienda.catalogohoy.com/')).toBeNull();
    expect(sellerSlugFromUrl('https://tienda.catalogohoy.com/v/<script>')).toBeNull();
  });

  it('la atribución vence a los 30 días', () => {
    const now = Date.UTC(2026, 10, 15);
    storeSellerSlug(7, 'juan', now);
    expect(readStoredSellerSlug(7, now + 29 * 86400000)).toBe('juan');
    expect(readStoredSellerSlug(7, now + 31 * 86400000)).toBeNull();
  });
});

import {
  formatExcelAddons,
  formatExcelVariants,
  mergeExcelAddons,
  mergeExcelVariants,
  parseExcelAddons,
  parseExcelNumber,
  parseExcelSizes,
  parseExcelVariants,
  parseExcelWholesale,
} from './product-excel-format';
import type { ProductVariant } from './product.model';

describe('product-excel-format (CAT-116)', () => {
  it('parseExcelNumber acepta coma decimal y símbolos', () => {
    expect(parseExcelNumber('10,5')).toBe(10.5);
    expect(parseExcelNumber('$12')).toBe(12);
    expect(parseExcelNumber('1.234,5')).toBe(1234.5);
    expect(parseExcelNumber('abc')).toBeNull();
    expect(parseExcelNumber('')).toBeNull();
  });

  it('tallas: con y sin stock', () => {
    expect(parseExcelSizes('S: 5, M, L: 0, XL: sin límite')).toEqual([
      { name: 'S', stock: 5 },
      { name: 'M', stock: null },
      { name: 'L', stock: 0 },
      { name: 'XL', stock: null },
    ]);
  });

  it('variantes: precio, antes, stock, sku, oculta y tallas propias', () => {
    const v = parseExcelVariants(
      'Rojo: 10 (antes 12) [tallas: S: 0, M: 3] | Azul: 12 (stock 4) (sku AZ-1) (oculta) | Casco (talla única): 30 | Verde'
    );
    expect(v).toEqual([
      {
        name: 'Rojo',
        price: 10,
        originalPrice: 12,
        sizes: [
          { name: 'S', stock: 0 },
          { name: 'M', stock: 3 },
        ],
      },
      {
        name: 'Azul',
        price: 12,
        originalPrice: 0,
        stock: 4,
        sku: 'AZ-1',
        hidden: true,
        sizes: [],
      },
      { name: 'Casco (talla única)', price: 30, originalPrice: 0, sizes: [] },
      { name: 'Verde', price: null, originalPrice: 0, sizes: [] },
    ]);
  });

  it('variantes: lo exportado se vuelve a leer igual (ida y vuelta)', () => {
    const original: ProductVariant[] = [
      {
        id: 'a',
        name: 'Rojo',
        price: 10,
        originalPrice: 12,
        sku: 'R-1',
        photos: ['x.jpg'],
        stock: null,
        sizes: [
          { name: 'S', stock: 2 },
          { name: 'M', stock: null },
        ],
      },
      {
        id: 'b',
        name: 'Azul',
        price: 11,
        originalPrice: 0,
        photos: [],
        stock: 7,
        sizes: [],
        isHidden: true,
      },
    ];
    const text = formatExcelVariants(original);
    expect(text).toBe(
      'Rojo: 10 (antes 12) (sku R-1) [tallas: S: 2, M] | Azul: 11 (stock 7) (oculta)'
    );
    const merged = mergeExcelVariants(parseExcelVariants(text), original, 5);
    expect(merged).toEqual([
      { ...original[0], isHidden: false, sizes: [
        { name: 'S', stock: 2, sku: null },
        { name: 'M', stock: null, sku: null },
      ] },
      { ...original[1], sku: null },
    ]);
  });

  it('merge: conserva id/fotos/stock existentes y crea las nuevas', () => {
    const existing: ProductVariant[] = [
      {
        id: 'keep',
        name: 'Rojo',
        price: 1,
        originalPrice: 0,
        sku: 'R',
        photos: ['rojo.jpg'],
        stock: 3,
        sizes: [],
      },
      {
        id: 'gone',
        name: 'Viejo',
        price: 1,
        originalPrice: 0,
        photos: [],
        stock: null,
        sizes: [],
      },
    ];
    const merged = mergeExcelVariants(
      parseExcelVariants('rojo: 20 | Nueva'),
      existing,
      9,
      () => 'new-id'
    );
    expect(merged).toEqual([
      {
        id: 'keep',
        name: 'rojo',
        price: 20,
        originalPrice: 0,
        sku: 'R',
        photos: ['rojo.jpg'],
        stock: 3,
        sizes: [],
        isHidden: false,
      },
      {
        id: 'new-id',
        name: 'Nueva',
        price: 9,
        originalPrice: 0,
        sku: null,
        photos: [],
        stock: null,
        sizes: [],
        isHidden: false,
      },
    ]);
  });

  it('adicionales: ida y vuelta conservando foto', () => {
    const text = 'Tarjeta: 0 (por defecto) | Envoltorio: 2,5';
    const parsed = parseExcelAddons(text);
    expect(parsed).toEqual([
      { name: 'Tarjeta', price: 0, isDefault: true },
      { name: 'Envoltorio', price: 2.5, isDefault: false },
    ]);
    const merged = mergeExcelAddons(
      parsed,
      [{ id: 't', name: 'Tarjeta', price: 1, photo: 'p.jpg' }],
      () => 'n'
    );
    expect(merged).toEqual([
      { id: 't', name: 'Tarjeta', price: 0, photo: 'p.jpg', isDefault: true },
      { id: 'n', name: 'Envoltorio', price: 2.5, photo: null, isDefault: false },
    ]);
    expect(formatExcelAddons(merged)).toBe(
      'Tarjeta: 0 (por defecto) | Envoltorio: 2.5'
    );
  });

  it('mayoreo', () => {
    expect(parseExcelWholesale('Docena: 8 | Caja: 6 | basura')).toEqual([
      { title: 'Docena', price: 8 },
      { title: 'Caja', price: 6 },
    ]);
  });
});

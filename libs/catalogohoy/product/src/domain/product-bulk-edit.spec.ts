import {
  applyBulkJsonPatch,
  buildBulkPatches,
  buildBulkRows,
  BulkEdits,
  parseBulkBool,
  parseBulkNumber,
  parseTsv,
  sameBulkValue,
  toTsv,
  validateBulkCell,
} from './product-bulk-edit';
import { Product, ProductPrimitives } from './product.model';

const make = (over: Partial<ProductPrimitives>): Product =>
  Product.fromPrimitives({
    id: '1',
    name: 'Casco',
    description: '',
    price: 20,
    pricePromotional: 0,
    photos: [],
    stock: '5',
    categoryList: {} as never,
    authUserId: 'u',
    createdAt: '',
    sku: 'CAS-1',
    productionCost: 10,
    position: 0,
    isWholesale: false,
    wholesaleTiers: [],
    isSoldOut: false,
    isHidden: false,
    isSized: false,
    sizes: [],
    ...over,
  });

describe('product bulk edit', () => {
  it('parsea números en formatos comunes', () => {
    expect(parseBulkNumber('')).toBeNull();
    expect(parseBulkNumber('20')).toBe(20);
    expect(parseBulkNumber('$ 1,234.50')).toBe(1234.5);
    expect(parseBulkNumber('1.234,50')).toBe(1234.5);
    expect(parseBulkNumber('12,5')).toBe(12.5);
    expect(parseBulkNumber('1,000')).toBe(1000);
    expect(parseBulkNumber('1.000.000')).toBe(1000000);
    expect(parseBulkNumber('abc')).toBeUndefined();
  });

  it('parsea Sí/No', () => {
    expect(parseBulkBool('Sí')).toBe(true);
    expect(parseBulkBool('TRUE')).toBe(true);
    expect(parseBulkBool('no')).toBe(false);
    expect(parseBulkBool('quizás')).toBeNull();
  });

  it('TSV ida y vuelta, con comillas y salto final de Excel', () => {
    expect(parseTsv('a\tb\nc\td\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseTsv('"x\ny"\tz')).toEqual([['x\ny', 'z']]);
    const m = [['a"b', 'c\td'], ['', 'e']];
    expect(parseTsv(toTsv(m))).toEqual(m);
  });

  it('arma filas de producto, variantes y tallas', () => {
    const p = make({
      isVariant: true,
      variants: [
        { id: 'v1', name: 'Rojo', price: 22, originalPrice: 0, photos: [], stock: 3, sizes: [] },
        {
          id: 'v2',
          name: 'Azul',
          price: 23,
          originalPrice: 30,
          photos: [],
          stock: null,
          sizes: [{ name: 'M', stock: 2 }],
        },
      ],
    });
    const rows = buildBulkRows([p]);
    expect(rows.map((r) => r.key)).toEqual(['p:1', 'v:1:v1', 'v:1:v2', 's:1:v2:0']);
    // Todas las variantes llevan su stock → el del producto no aplica.
    expect('stock' in rows[0].original).toBe(false);
    expect(rows[1].original.stock).toBe('3');
    expect('stock' in rows[2].original).toBe(false); // tiene tallas
    expect(rows[2].original.originalPrice).toBe('30');
    expect(rows[3].original).toEqual({ option: 'M', stock: '2', sku: '' });
    expect('pricePromotional' in rows[1].original).toBe(false);
  });

  it('valida celdas', () => {
    const [row] = buildBulkRows([make({})]);
    expect(validateBulkCell(row, 'name', ' ')).toBeTruthy();
    expect(validateBulkCell(row, 'price', '')).toBeTruthy();
    expect(validateBulkCell(row, 'price', '-1')).toBeTruthy();
    expect(validateBulkCell(row, 'stock', '')).toBeNull();
    expect(validateBulkCell(row, 'stock', '2.5')).toBeTruthy();
    expect(sameBulkValue('number', '20', '20.00')).toBe(true);
  });

  it('construye parches solo con lo modificado', () => {
    const p = make({
      isVariant: true,
      variants: [{ id: 'v1', name: 'Rojo', price: 22, originalPrice: 0, photos: [], stock: null, sizes: [] }],
    });
    const rows = buildBulkRows([p]);
    const edits: BulkEdits = new Map([
      ['p:1', { price: '25', visible: false, pricePromotional: '' }],
      ['v:1:v1', { stock: '7', option: 'Rojo mate' }],
    ]);
    const [patch] = buildBulkPatches(rows, edits);
    expect(patch.fields).toEqual({ price: 25, is_hidden: true, price_promotional: null });
    expect(patch.variants).toEqual([{ variantId: 'v1', stock: 7, name: 'Rojo mate' }]);
    expect(patch.changes.length).toBe(5);
  });

  it('aplica variantes/tallas sobre el JSON actual sin pisar otros campos', () => {
    const current = {
      sizes: [{ name: 'S', stock: 1 }],
      variants: [
        { id: 'v1', name: 'Rojo', price: 1, stock: 4, photos: ['a'], sizes: [] },
        { id: 'v2', name: 'Azul', price: 1, sizes: [{ name: 'M', stock: 9 }] },
      ],
    };
    const out = applyBulkJsonPatch(current, {
      variants: [{ variantId: 'v1', price: 5 }],
      sizes: [
        { variantId: 'v2', index: 0, originalName: 'M', stock: 3 },
        { variantId: null, index: 0, originalName: 'S', sku: 'X' },
      ],
    });
    if ('error' in out) throw new Error(out.error);
    expect(out.variants[0]).toEqual({ id: 'v1', name: 'Rojo', price: 5, stock: 4, photos: ['a'], sizes: [] });
    expect(out.variants[1].sizes).toEqual([{ name: 'M', stock: 3 }]);
    expect(out.sizes).toEqual([{ name: 'S', stock: 1, sku: 'X' }]);
    expect(
      'error' in applyBulkJsonPatch(current, { variants: [{ variantId: 'zz', price: 1 }], sizes: [] })
    ).toBe(true);
  });
});

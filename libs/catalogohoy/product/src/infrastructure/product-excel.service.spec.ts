import { TestBed } from '@angular/core/testing';
import type { Product } from '../domain';

// El spec solo ejercita el export (puro); las dependencias inyectadas arrastran
// cadenas ESM (core → posthog-js) que Jest no parsea → se mockean los módulos.
jest.mock('@catalogohoy/category', () => ({ CategoryStore: class {} }));
jest.mock('./product.service', () => ({ ProductService: class {} }));

import { CategoryStore } from '@catalogohoy/category';
import { ProductExcelService } from './product-excel.service';
import { ProductService } from './product.service';

/** Producto mínimo para el export (solo los campos que lee buildExportRows). */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    name: 'Perfume Uno',
    description: '<p>Aroma  cítrico</p>',
    price: 1400,
    pricePromotional: null,
    stock: 3,
    sku: 'SKU-1',
    productionCost: null,
    categoryList: { categories: [{ id: 1, name: 'Dama' }] },
    sizes: [],
    isWholesale: false,
    wholesaleTiers: [],
    isVariant: false,
    variants: [],
    ...overrides,
  } as unknown as Product;
}

describe('ProductExcelService.exportToCsv', () => {
  let service: ProductExcelService;
  let lastBlob: Blob | null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductExcelService,
        { provide: ProductService, useValue: {} },
        { provide: CategoryStore, useValue: {} },
      ],
    });
    service = TestBed.inject(ProductExcelService);

    lastBlob = null;
    // jsdom no implementa createObjectURL: capturamos el Blob y anulamos el click.
    globalThis.URL.createObjectURL = jest.fn((b: Blob) => {
      lastBlob = b;
      return 'blob:fake';
    });
    globalThis.URL.revokeObjectURL = jest.fn();
    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
  });

  async function exportedCsv(products: Product[]): Promise<string> {
    const result = service.exportToCsv(products);
    expect(result.isRight()).toBe(true);
    expect(lastBlob).not.toBeNull();
    // jsdom no implementa Blob.text() → FileReader.
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsText(lastBlob as unknown as Blob);
    });
  }

  it('genera el CSV con BOM, los headers del import y la fila del producto', async () => {
    const csv = await exportedCsv([makeProduct()]);

    // readAsText decodifica (y consume) el BOM → se verifica en bytes crudos.
    const bytes = await new Promise<Uint8Array>((res) => {
      const r = new FileReader();
      r.onload = () => res(new Uint8Array(r.result as ArrayBuffer));
      r.readAsArrayBuffer(lastBlob as unknown as Blob);
    });
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const [header, row] = csv.replace(/^﻿/, '').split('\n');
    expect(header).toBe(
      'nombre,descripcion,precio,precio_promocional,stock,agotado,sku,costo_produccion,categorias,tallas,mayoreo,variantes,adicionales'
    );
    // El HTML de la descripción se aplana a texto.
    expect(row).toContain('Perfume Uno');
    expect(row).toContain('Aroma cítrico');
    expect(row).not.toContain('<p>');
  });

  it('marca la columna agotado con la regla del catálogo (tallas y variantes incluidas)', async () => {
    const csv = await exportedCsv([
      makeProduct({ name: 'ConStock', stock: '3' }),
      makeProduct({ name: 'SinStock', stock: '0' }),
      makeProduct({ name: 'Ilimitado', stock: null }),
      makeProduct({ name: 'Manual', stock: '5', isSoldOut: true }),
      makeProduct({
        name: 'TallasAgotadas',
        stock: null,
        isSized: true,
        sizes: [{ name: 'S', stock: 0 }, { name: 'M', stock: 0 }],
      } as unknown as Partial<Product>),
      makeProduct({
        name: 'TallasConStock',
        stock: null,
        isSized: true,
        sizes: [{ name: 'S', stock: 0 }, { name: 'M', stock: 2 }],
      } as unknown as Partial<Product>),
      makeProduct({
        name: 'VariantesAgotadas',
        stock: null,
        isVariant: true,
        variants: [
          { name: 'Rojo', price: 10, sizes: [{ name: 'S', stock: 0 }] },
          { name: 'Azul', price: 10, sizes: [{ name: 'M', stock: 0 }] },
        ],
      } as unknown as Partial<Product>),
    ]);

    const lines = csv.replace(/^\uFEFF/, '').trim().split('\n');
    const idx = lines[0].split(',').indexOf('agotado');
    const byName = Object.fromEntries(
      lines.slice(1).map((l) => [l.split(',')[0], l.split(',')[idx]])
    );
    expect(byName).toEqual({
      ConStock: 'No',
      SinStock: 'Sí',
      Ilimitado: 'No',
      Manual: 'Sí',
      TallasAgotadas: 'Sí',
      TallasConStock: 'No',
      VariantesAgotadas: 'Sí',
    });
  });

  it('escapa comas, comillas y saltos de línea sin romper columnas', async () => {
    const csv = await exportedCsv([
      makeProduct({
        name: 'Combo "Premium", edición 2',
        description: 'Línea 1<br>Línea 2, con coma',
      }),
    ]);

    // RFC 4180: el campo va entre comillas y las comillas internas se duplican.
    expect(csv).toContain('"Combo ""Premium"", edición 2"');
    // La descripción queda en UNA sola celda (el <br> se aplana, no hay \n crudo).
    const dataLines = csv.trim().split('\n');
    expect(dataLines).toHaveLength(2); // header + 1 fila
  });

  it('re-importa el CSV sin corromper SKUs, nombres con "=" ni stock 0', async () => {
    // Roundtrip: lo que exportamos debe volver INTACTO por parseExcelFile.
    const csv = [
      'nombre,descripcion,precio,precio_promocional,stock,sku,costo_produccion,categorias',
      '"=OFERTA especial",desc,1400,,0,00123,,Dama',
    ].join('\n');
    const file = new File(['﻿' + csv], 'productos.csv', {
      type: 'text/csv',
    });

    const result = await service.parseExcelFile(file);
    expect(result.isRight()).toBe(true);
    const row = result.value as unknown as Array<Record<string, unknown>>;
    expect(row[0]['name']).toBe('=OFERTA especial'); // no se trata como fórmula
    expect(row[0]['sku']).toBe('00123'); // conserva ceros a la izquierda
    expect(row[0]['stock']).toBe('0'); // 0 = agotado, NO "sin límite"
    expect(row[0]['price']).toBe(1400);
  });

  it('lee variantes, tallas y adicionales del archivo (CAT-116)', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.json_to_sheet([
      {
        nombre: 'Franela',
        precio: 15,
        variantes: 'Roja: 15 (antes 18) [tallas: S: 5, M: 0] | Azul: 16 (stock 4)',
        adicionales: 'Tarjeta: 0 (por defecto) | Envoltorio: 2',
        tallas: '',
      },
      { nombre: 'Gorra', precio: 8, tallas: 'Única: 20', variantes: '' },
      { nombre: 'Simple', precio: 3 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Productos');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = await service.parseExcelFile(new File([bytes], 'p.xlsx'));
    expect(result.isRight()).toBe(true);
    const rows = result.value as import('../domain').ProductExcelRow[];
    expect(rows[0].variants?.map((v) => v.name)).toEqual(['Roja', 'Azul']);
    expect(rows[0].variants?.[0].sizes).toEqual([
      { name: 'S', stock: 5 },
      { name: 'M', stock: 0 },
    ]);
    expect(rows[0].addons).toHaveLength(2);
    expect(rows[0].sizes).toBeUndefined();
    expect(rows[1].sizes).toEqual([{ name: 'Única', stock: 20 }]);
    expect(rows[1].variants).toBeUndefined();
    // Sin columnas ricas → nada que tocar al actualizar.
    expect(rows[2].variants).toBeUndefined();
    expect(rows[2].addons).toBeUndefined();
  });

  it('crea el producto con variantes y adicionales, y respeta el límite del plan', async () => {
    // jsdom no trae crypto.randomUUID.
    let n = 0;
    (globalThis.crypto as unknown as { randomUUID: () => string }).randomUUID =
      () => `id-${++n}`;
    const create = jest.fn().mockResolvedValue({ isLeft: () => false, mapRight: (f: () => unknown) => ({ isRight: () => true, value: f() }) });
    const svc = service as unknown as { productService: Record<string, unknown> };
    svc.productService = {
      findProductIdForImport: jest.fn().mockResolvedValue(null),
      create,
    };
    (service as unknown as { categoryStore: unknown }).categoryStore = {
      categoryList: () => ({ categories: [] }),
    };
    const row = {
      name: 'Franela',
      description: '',
      price: 15,
      pricePromotional: null,
      stock: '9',
      sku: null,
      productionCost: null,
      categories: '',
      variants: [
        { name: 'Roja', price: null, originalPrice: 0, sizes: [{ name: 'S', stock: 2 }] },
        { name: 'Azul', price: 16, originalPrice: 0, stock: 4, sizes: [] },
      ],
      addons: [{ name: 'Tarjeta', price: 0, isDefault: true }],
    };

    const blocked = await service.importRow(row, { maxVariants: 1, maxAddons: 5 });
    expect(blocked.isLeft()).toBe(true);
    expect(create).not.toHaveBeenCalled();

    await service.importRow(row, { maxVariants: 5, maxAddons: 5 });
    const input = create.mock.calls[0][0];
    expect(input.isVariant).toBe(true);
    expect(input.variants).toEqual([
      expect.objectContaining({ name: 'Roja', price: '15', stock: null, sizes: [{ name: 'S', stock: '2' }] }),
      expect.objectContaining({ name: 'Azul', price: '16', stock: '4', sizes: [] }),
    ]);
    expect(input.addons).toEqual([
      { id: null, name: 'Tarjeta', price: 0, photo: null, isDefault: true },
    ]);
  });

  it('serializa variantes y mayoreo con el mismo formato que el Excel', async () => {
    const csv = await exportedCsv([
      makeProduct({
        isVariant: true,
        variants: [
          { name: 'Rojo', price: 10, originalPrice: 12, sizes: [] },
          { name: 'Azul', price: 11, originalPrice: null, sizes: [] },
        ],
        isWholesale: true,
        wholesaleTiers: [{ title: '1-10', price: 9 }],
      } as unknown as Partial<Product>),
    ]);

    expect(csv).toContain('Rojo: 10 (antes 12) | Azul: 11');
    expect(csv).toContain('1-10: 9');
  });

  it('encuentra el encabezado real aunque la planilla traiga un título arriba', async () => {
    // Caso Motofox: "Consolidado de facturas" en la fila 1, encabezado en la 3
    // y una fila de totales sin descripción al final.
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Consolidado Facturas Moto Fox 23/10/2026'],
      [],
      ['Código', 'Descripción', 'Cantidad', 'Precio'],
      ['64712', 'MINI EXPLORADORA LED', 15, 5.01],
      ['4007', 'FARO LED C/BASE', 50, 3.81],
      ['', '', 4843, 608.63],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Hoja1');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([bytes], 'consolidado.xlsx');

    const result = await service.extractRawData(file);
    expect(result.isRight()).toBe(true);
    const { headers, rows } = result.value as {
      headers: string[];
      rows: Record<string, unknown>[];
    };
    expect(headers).toEqual(['Código', 'Descripción', 'Cantidad', 'Precio']);
    expect(rows).toHaveLength(3);
    expect(rows[0]['Descripción']).toBe('MINI EXPLORADORA LED');
    expect(rows[0]['Precio']).toBe(5.01);
  });
});

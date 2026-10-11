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
      'nombre,descripcion,precio,precio_promocional,stock,sku,costo_produccion,categorias,tallas,mayoreo,variantes'
    );
    // El HTML de la descripción se aplana a texto.
    expect(row).toContain('Perfume Uno');
    expect(row).toContain('Aroma cítrico');
    expect(row).not.toContain('<p>');
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
});

import { inject, Injectable } from '@angular/core';
import { CategoryStore } from '@catalogohoy/category';
import { E } from '@shared/domain';
import * as XLSX from 'xlsx';
import { CreateProductInput, Product, ProductExcelRow } from '../domain';
import { ProductService } from './product.service';

@Injectable({ providedIn: 'root' })
export class ProductExcelService {
  private readonly productService = inject(ProductService);
  private readonly categoryStore = inject(CategoryStore);

  public exportToExcel(products: Product[]): E.Either<Error, void> {
    try {
      const rows = products.map((p) => ({
        nombre: p.name,
        descripcion: this.stripHtml(p.description ?? ''),
        precio: p.price,
        precio_promocional: p.pricePromotional || '',
        stock: p.stock ?? '',
        sku: p.sku ?? '',
        costo_produccion: p.productionCost ?? '',
        categorias: p.categoryList.categories.map((c) => c.name).join(', '),
        tallas: this.formatSizes(p.sizes),
        mayoreo: p.isWholesale
          ? p.wholesaleTiers.map((t) => `${t.title}: ${t.price}`).join(' | ')
          : '',
        variantes: p.isVariant
          ? p.variants
              .map((v) => {
                const tallas = v.sizes?.length
                  ? ` [tallas: ${this.formatSizes(v.sizes)}]`
                  : '';
                const original = v.originalPrice
                  ? ` (antes ${v.originalPrice})`
                  : '';
                return `${v.name}: ${v.price}${original}${tallas}`;
              })
              .join(' | ')
          : '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Cap the auto width so long values (image URLs, variants) don't blow the
      // column out to thousands of chars.
      const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
        wch: Math.min(
          60,
          Math.max(
            key.length,
            ...rows.map(
              (r) => String((r as Record<string, unknown>)[key] ?? '').length
            )
          ) + 2
        ),
      }));
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
      XLSX.writeFile(
        workbook,
        `productos_${new Date().toISOString().slice(0, 10)}.xlsx`
      );

      return E.right(undefined);
    } catch {
      return E.left(new Error('Error al exportar productos'));
    }
  }

  /** Strips HTML tags + decodes entities so the description is plain text. */
  private stripHtml(html: string): string {
    if (!html) return '';
    const el = document.createElement('div');
    el.innerHTML = html;
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /** "S: 5, M: sin límite, L: 3" (omits stock when unlimited). */
  private formatSizes(
    sizes: { name: string; stock: number | null }[] | undefined
  ): string {
    if (!sizes?.length) return '';
    return sizes
      .map((s) => (s.stock != null ? `${s.name}: ${s.stock}` : s.name))
      .join(', ');
  }

  public parseExcelFile(
    file: File
  ): Promise<E.Either<Error, ProductExcelRow[]>> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows =
            XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

          if (jsonRows.length === 0) {
            resolve(E.left(new Error('El archivo no contiene datos')));
            return;
          }

          const firstRow = jsonRows[0];
          if (!('nombre' in firstRow) || !('precio' in firstRow)) {
            resolve(
              E.left(
                new Error(
                  'El archivo no tiene las columnas requeridas (nombre, precio). Descarga la plantilla.'
                )
              )
            );
            return;
          }

          const rows: ProductExcelRow[] = jsonRows.map((row) => ({
            name: String(row['nombre'] ?? '').trim(),
            description: String(row['descripcion'] ?? '').trim(),
            price: Number(row['precio'] ?? 0),
            pricePromotional: row['precio_promocional']
              ? Number(row['precio_promocional'])
              : null,
            stock:
              !row['stock'] || row['stock'] === ''
                ? null
                : String(row['stock']),
            sku: row['sku'] ? String(row['sku']).trim() : null,
            productionCost: row['costo_produccion']
              ? Number(row['costo_produccion'])
              : null,
            categories: String(row['categorias'] ?? '').trim(),
          }));

          resolve(E.right(rows));
        } catch {
          resolve(
            E.left(
              new Error(
                'Error al leer el archivo. Asegurate de que sea un .xlsx valido.'
              )
            )
          );
        }
      };

      reader.onerror = () =>
        resolve(E.left(new Error('Error al leer el archivo')));
      reader.readAsArrayBuffer(file);
    });
  }

  public extractRawData(
    file: File
  ): Promise<E.Either<Error, { headers: string[]; rows: Record<string, unknown>[] }>> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

          if (jsonRows.length === 0) {
            resolve(E.left(new Error('El archivo no contiene datos')));
            return;
          }

          const headers = Object.keys(jsonRows[0]);
          resolve(E.right({ headers, rows: jsonRows }));
        } catch {
          resolve(
            E.left(new Error('Error al leer el archivo. Asegurate de que sea un .xlsx valido.'))
          );
        }
      };

      reader.onerror = () => resolve(E.left(new Error('Error al leer el archivo')));
      reader.readAsArrayBuffer(file);
    });
  }

  public async importRow(row: ProductExcelRow): Promise<E.Either<Error, void>> {
    const categoryIds = this.resolveCategoryIds(row.categories);

    const input: CreateProductInput = {
      name: row.name,
      description: row.description || null,
      price: String(row.price),
      pricePromotional:
        row.pricePromotional != null ? String(row.pricePromotional) : '',
      photos: [],
      stock: row.stock,
      categoryIds,
      sku: row.sku,
      productionCost:
        row.productionCost != null ? String(row.productionCost) : null,
      isWholesale: false,
      wholesaleTiers: [],
      isSoldOut: false,
      isHidden: false,
      isSized: false,
      sizes: [],
      isVariant: false,
      variants: [],
    };

    return this.productService.create(input);
  }

  public downloadTemplate(): void {
    const templateRow = {
      nombre: 'Producto Ejemplo',
      descripcion: 'Descripcion del producto',
      precio: 10.99,
      precio_promocional: 8.99,
      stock: '100',
      sku: 'PRD-001',
      costo_produccion: 5.0,
      categorias: 'Ropa, Accesorios',
    };

    const worksheet = XLSX.utils.json_to_sheet([templateRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');
    XLSX.writeFile(workbook, 'plantilla_productos.xlsx');
  }

  private resolveCategoryIds(categoriesStr: string): string[] {
    if (!categoriesStr.trim()) return [];
    const names = categoriesStr.split(',').map((n) => n.trim().toLowerCase());
    const allCategories = this.categoryStore.categoryList().categories;
    return allCategories
      .filter((c) => names.includes(c.name.toLowerCase()))
      .map((c) => String(c.id));
  }
}

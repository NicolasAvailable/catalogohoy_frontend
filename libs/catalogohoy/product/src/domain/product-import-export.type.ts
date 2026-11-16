import type { ExcelAddon, ExcelSize, ExcelVariant } from './product-excel-format';
import type { WholesaleTier } from './product.model';

export interface ProductExcelRow {
  name: string;
  description: string;
  price: number;
  pricePromotional: number | null;
  stock: string | null;
  sku: string | null;
  productionCost: number | null;
  categories: string;
  /** Columnas "ricas" (CAT-116). `undefined`/vacío = la celda venía vacía →
   *  al actualizar NO se tocan (se conservan las de la app). */
  sizes?: ExcelSize[];
  variants?: ExcelVariant[];
  addons?: ExcelAddon[];
  wholesaleTiers?: WholesaleTier[];
}

export type ImportRowStatus = 'pending' | 'importing' | 'success' | 'error';

export interface ImportRowResult {
  rowIndex: number;
  data: ProductExcelRow;
  status: ImportRowStatus;
  errorMessage?: string;
}

export interface ImportSummary {
  total: number;
  success: number;
  errors: number;
}

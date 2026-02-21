export interface ProductExcelRow {
  name: string;
  description: string;
  price: number;
  pricePromotional: number | null;
  stock: string | null;
  sku: string | null;
  productionCost: number | null;
  categories: string;
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

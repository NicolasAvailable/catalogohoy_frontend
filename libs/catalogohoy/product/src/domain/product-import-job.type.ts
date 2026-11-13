/** Import de productos que corre en segundo plano (tabla
 *  `product_import_jobs`). Se crea al empezar a importar y se actualiza
 *  mientras avanza, así el resultado queda en Productos aunque el usuario
 *  haya cerrado el modal (y le llega un correo si lo dejó en segundo plano). */
export type ProductImportJobSource = 'excel' | 'sheets' | 'pdf' | 'fotos';
export type ProductImportJobStatus = 'running' | 'done' | 'cancelled';

export interface ProductImportJobFailure {
  name: string;
  error: string;
}

export interface ProductImportJob {
  id: string;
  source: ProductImportJobSource;
  fileName: string | null;
  status: ProductImportJobStatus;
  total: number;
  processed: number;
  success: number;
  errors: number;
  /** Fotos que no entraron por el límite de fotos del plan. */
  skipped: number;
  failed: ProductImportJobFailure[];
  backgrounded: boolean;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface ProductImportJobProgress {
  processed: number;
  success: number;
  errors: number;
  skipped?: number;
  failed?: ProductImportJobFailure[];
}

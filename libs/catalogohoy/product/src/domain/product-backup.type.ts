/** Metadatos de un backup de productos (fila de `product_backups`). */
export interface ProductBackup {
  id: number;
  createdAt: string;
  reason: string;
  productCount: number;
}

/** Un producto dentro del snapshot jsonb (columnas de `products` en snake_case
 *  + los nombres de sus categorías). Solo tipamos lo que usamos para
 *  descargar/restaurar; el resto viaja tal cual. */
export interface ProductBackupSnapshotRow {
  name?: string;
  description?: string | null;
  price?: number | string;
  price_promotional?: number | string | null;
  stock?: number | string | null;
  sku?: string | null;
  production_cost?: number | string | null;
  is_wholesale?: boolean;
  wholesale_tiers?: { title: string; price: number | string }[];
  is_sized?: boolean;
  sizes?: { name: string; stock: number | null; sku?: string | null }[];
  is_variant?: boolean;
  variants?: {
    name: string;
    price: number | string;
    originalPrice?: number | string;
    sizes?: { name: string; stock: number | null }[];
  }[];
  categories?: string[];
}

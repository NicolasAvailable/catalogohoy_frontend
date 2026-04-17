export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ActivityLogEntry {
  id: number;
  userEmail: string;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  entityName: string | null;
  changes: FieldChange[];
  createdAt: string;
}

export interface ActivityLogPage {
  entries: ActivityLogEntry[];
  totalCount: number;
}

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  'product.create': 'creó el producto',
  'product.update': 'editó el producto',
  'product.delete': 'eliminó el producto',
  'order.create': 'creó la orden',
  'order.update': 'editó la orden',
  'order.delete': 'eliminó la orden',
  'order.status': 'cambió el estado de la orden',
  'category.create': 'creó la categoría',
  'category.update': 'editó la categoría',
  'category.delete': 'eliminó la categoría',
  'catalog.update': 'editó el catálogo',
};

export const FIELD_LABELS: Record<string, string> = {
  name: 'nombre',
  description: 'descripción',
  price: 'precio',
  pricePromotional: 'precio promocional',
  stock: 'stock',
  sku: 'SKU',
  status: 'estado',
  isVisible: 'visibilidad',
  isSoldOut: 'agotado',
  isHidden: 'oculto',
  position: 'posición',
  state: 'estado/provincia',
  city: 'ciudad',
  country: 'país',
  currencySymbol: 'moneda',
  themeColor: 'color del tema',
  template: 'plantilla',
  deliveryDate: 'fecha de entrega',
};

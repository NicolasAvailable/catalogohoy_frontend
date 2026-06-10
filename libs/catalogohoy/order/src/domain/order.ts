export interface OrderItem {
  productId: string | number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  photo?: string;
  sku?: string | null;
  size?: string | null;
  isCustom?: boolean;
  description?: string;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled';

export interface Order {
  id: number;
  /** Per-tenant incremental number shown in the UI (#N). Display-only;
   *  routing and lookups still use the global `id`. */
  orderNumber?: number;
  name: string;
  products: OrderItem[];
  status: OrderStatus;
  tenantId: number;
  totalUsd: number;
  totalBs?: number;
  createdAt: string;
  updatedAt: string;
  phone?: string;
  comments?: string;
  paymentMethod?: string;
  /** ISO date "YYYY-MM-DD". Defaults to the creation date on the server. */
  deliveryDate: string;
}

export class OrderList {
  constructor(public readonly items: Order[]) {}

  static empty(): OrderList {
    return new OrderList([]);
  }
}

export interface OrderItem {
  productId: string | number;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export type OrderStatus = 'pending' | 'completed';

export interface Order {
  id: number;
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
}

export class OrderList {
  constructor(public readonly items: Order[]) {}

  static empty(): OrderList {
    return new OrderList([]);
  }
}

import { Order, OrderItem, OrderStatus } from './order';

export class OrderMapper {
  static toDomain(entity: unknown): Order {
    const e = entity as any;
    return {
      id: e.id,
      name: e.name,
      products: Array.isArray(e.products)
        ? e.products.map(OrderMapper.toOrderItemDomain)
        : [],
      status: e.status as OrderStatus,
      tenantId: e.tenant_id,
      totalUsd: e.total_usd,
      totalBs: e.total_bs,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      phone: e.phone,
      comments: e.comments,
      paymentMethod: e.payment_method,
      deliveryDate: e.delivery_date,
    };
  }

  private static toOrderItemDomain(item: unknown): OrderItem {
    const i = item as any;
    return {
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      total: i.total,
      photo: i.photo,
      sku: i.sku ?? null,
      size: i.size ?? null,
    };
  }

  static toDomainList(entities: unknown[]): Order[] {
    return entities.map(OrderMapper.toDomain);
  }
}

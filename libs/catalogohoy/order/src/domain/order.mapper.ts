import { Order, OrderItem, OrderStatus } from './order';

export class OrderMapper {
  static toDomain(entity: unknown): Order {
    const e = entity as any;
    return {
      id: e.id,
      orderNumber: e.order_number,
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
      email: e.email ?? undefined,
      comments: e.comments,
      internalNotes: Array.isArray(e.internal_notes) ? e.internal_notes : [],
      paymentMethod: e.payment_method,
      shippingMethod: e.shipping_method ?? null,
      shippingAddress: e.shipping_address ?? null,
      shippingFee: e.shipping_fee != null ? Number(e.shipping_fee) : undefined,
      discountAmount: e.discount_amount != null ? Number(e.discount_amount) : 0,
      discountCode: e.discount_code ?? null,
      discountLabel: e.discount_label ?? null,
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
      variantId: i.variantId ?? null,
      variantName: i.variantName ?? null,
    };
  }

  static toDomainList(entities: unknown[]): Order[] {
    return entities.map(OrderMapper.toDomain);
  }
}

export interface OrderItem {
  productId: string | number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  photo?: string;
  sku?: string | null;
  size?: string | null;
  /** Variant id chosen at order time (when the product has variants). */
  variantId?: string | null;
  /** Variant label snapshot, shown next to the product name. */
  variantName?: string | null;
  isCustom?: boolean;
  description?: string;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled';

/** A single internal team note (chat-style). */
export interface InternalNote {
  author: string;
  text: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Author's profile photo at the time the note was left (may be null). */
  authorPhoto?: string | null;
  /** Attached media (image/video URLs). */
  media?: string[];
}

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
  email?: string;
  comments?: string;
  /** Internal team notes thread — admin-only, never shown to the customer. */
  internalNotes?: InternalNote[];
  paymentMethod?: string;
  /** Snapshot of the shipping option chosen at checkout. Local string union
   *  (not imported from ecommerce-config) to avoid a cross-lib cycle. */
  shippingMethod?: {
    name: string;
    type: 'pickup' | 'delivery' | 'shipping';
    fee: number;
  } | null;
  /** Customer-entered delivery address (when the method requests it). */
  shippingAddress?: string | null;
  /** Flat shipping fee added to the total. */
  shippingFee?: number;
  /** Discount applied to the products subtotal (0 when none). */
  discountAmount?: number;
  /** Coupon code applied, if any. */
  discountCode?: string | null;
  /** Human label of the applied discount (e.g. "Cupón VERANO10"). */
  discountLabel?: string | null;
  /** ISO date "YYYY-MM-DD". Defaults to the creation date on the server. */
  deliveryDate: string;
}

export class OrderList {
  constructor(public readonly items: Order[]) {}

  static empty(): OrderList {
    return new OrderList([]);
  }
}

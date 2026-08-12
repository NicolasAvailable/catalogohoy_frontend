/** A paid extra chosen for a line at order time. `price` is per-unit of the
 *  addon; its contribution to the line is `price * quantity` and is already
 *  folded into the line's unit `price`. Kept here so the receipt/invoice can
 *  itemise what was added (with its quantity). */
export interface OrderItemAddon {
  id?: string;
  name: string;
  price: number;
  /** How many of this addon. Absent = 1 (storefront checkout only adds 1). */
  quantity?: number;
}

export interface OrderItem {
  productId: string | number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  photo?: string;
  sku?: string | null;
  size?: string | null;
  /** Paid extras added to this line (snapshot). Shown under the product name. */
  addons?: OrderItemAddon[] | null;
  /** Variant id chosen at order time (when the product has variants). */
  variantId?: string | null;
  /** Variant label snapshot, shown next to the product name. */
  variantName?: string | null;
  /** Wholesale tier (escala) chosen at order time — its per-unit price is
   *  what `price` reflects. Snapshot del título del tramo (ej. "12+ unidades"). */
  tierTitle?: string | null;
  isCustom?: boolean;
  description?: string;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled';

/** Admin-only payment proof attached to a manual order/sale. */
export interface PaymentEvidence {
  /** Free-form note (e.g. reference number, bank, conditions). */
  note?: string;
  /** Uploaded image URLs (transfer screenshots, receipts). */
  images: string[];
}

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
  /** Admin-only proof of payment for a manual sale/order: a free-form note plus
   *  uploaded image URLs (transfer screenshots, etc.). Captured only from the
   *  admin order form — never from the public catalog checkout — and never
   *  printed on the customer receipt PDF. */
  paymentEvidence?: PaymentEvidence | null;
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
  /** ISO date "YYYY-MM-DD". Defaults to the creation date on the server. */
  deliveryDate: string;
}

export class OrderList {
  constructor(public readonly items: Order[]) {}

  static empty(): OrderList {
    return new OrderList([]);
  }
}

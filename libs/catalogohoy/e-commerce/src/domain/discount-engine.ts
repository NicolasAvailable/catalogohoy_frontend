import { PublicDiscount } from '@catalogohoy/ecommerce-config';

/** A cart line as the discount engine needs it: unit price + quantity. */
export interface DiscountCartItem {
  price: number;
  quantity: number;
}

/** A coupon code already validated server-side (validate_discount_code). */
export interface AppliedCode {
  id: number;
  name: string;
  code: string;
  valueType: 'percent' | 'fixed';
  value: number;
  freeShipping: boolean;
}

export interface DiscountContext {
  items: DiscountCartItem[];
  subtotal: number;
  /** Total units across the cart. */
  itemCount: number;
  /** Resolved externally (RPC is_first_purchase) — gates first_purchase rules. */
  isFirstPurchase: boolean;
  /** Applied coupon code, if the customer entered a valid one. */
  appliedCode: AppliedCode | null;
}

export interface DiscountResult {
  /** Discount applied to the products subtotal (never below 0, never above it). */
  amount: number;
  /** Whether the shipping fee is waived. */
  freeShipping: boolean;
  /** Human-readable label for the receipt/WhatsApp (e.g. "Cupón VERANO10"). */
  label: string | null;
  /** The applied code, if any (persisted on the order). */
  code: string | null;
}

const EMPTY: DiscountResult = {
  amount: 0,
  freeShipping: false,
  label: null,
  code: null,
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Money value of a percent/fixed discount over a base, capped at the base. */
function valueOf(
  valueType: 'percent' | 'fixed' | null,
  value: number,
  base: number
): number {
  if (!valueType || !(value > 0) || !(base > 0)) return 0;
  const raw = valueType === 'percent' ? (base * value) / 100 : value;
  return round2(Math.min(raw, base));
}

/** BOGO discount: the cheapest `get.quantity` units (across the whole cart) get
 *  a percent/fixed discount, provided the cart has at least `buy.quantity`
 *  units. "Buy 2 get 1 free" → buy.quantity 2, get {quantity:1, percent:100}. */
function bogoAmount(items: DiscountCartItem[], d: PublicDiscount): number {
  const buyQty = d.bogoBuy?.quantity ?? 0;
  const get = d.bogoGet;
  if (!get || buyQty <= 0 || get.quantity <= 0) return 0;

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  if (totalUnits < buyQty) return 0;

  // Expand to per-unit prices, cheapest first.
  const units: number[] = [];
  for (const it of items) {
    for (let n = 0; n < it.quantity; n++) units.push(it.price);
  }
  units.sort((a, b) => a - b);

  const eligible = Math.min(get.quantity, units.length);
  let amount = 0;
  for (let i = 0; i < eligible; i++) {
    amount +=
      get.valueType === 'percent'
        ? (units[i] * get.value) / 100
        : Math.min(get.value, units[i]);
  }
  return round2(amount);
}

/** Money + free-shipping a single automatic rule yields, 0 if it doesn't apply. */
function evalRule(
  d: PublicDiscount,
  ctx: DiscountContext
): { amount: number; freeShipping: boolean } | null {
  switch (d.type) {
    case 'automatic':
      return { amount: valueOf(d.valueType, d.value, ctx.subtotal), freeShipping: d.freeShipping };
    case 'order_value':
      if (ctx.subtotal < d.minOrder) return null;
      return { amount: valueOf(d.valueType, d.value, ctx.subtotal), freeShipping: d.freeShipping };
    case 'package':
      if (ctx.itemCount < d.minItems) return null;
      return { amount: valueOf(d.valueType, d.value, ctx.subtotal), freeShipping: d.freeShipping };
    case 'first_purchase':
      if (!ctx.isFirstPurchase) return null;
      return { amount: valueOf(d.valueType, d.value, ctx.subtotal), freeShipping: d.freeShipping };
    case 'free_shipping':
      if (ctx.subtotal < d.minOrder) return null;
      return { amount: 0, freeShipping: true };
    case 'bogo':
      return { amount: bogoAmount(ctx.items, d), freeShipping: d.freeShipping };
    default:
      return null;
  }
}

/**
 * Resolve the discount for a cart.
 *
 * Rules:
 *  - At most ONE value discount applies. A valid coupon code wins; otherwise the
 *    best-qualifying automatic rule (by money saved) is used.
 *  - Free shipping is granted if the winning value discount grants it OR any
 *    qualifying `free_shipping` rule exists (free shipping stacks on top).
 *  - The product discount is clamped to the subtotal.
 */
export function resolveDiscount(
  discounts: PublicDiscount[],
  ctx: DiscountContext
): DiscountResult {
  // Best automatic value discount (and whether it also frees shipping).
  let best: { amount: number; freeShipping: boolean; label: string } | null = null;
  let anyFreeShipping = false;

  for (const d of discounts ?? []) {
    const r = evalRule(d, ctx);
    if (!r) continue;
    if (r.freeShipping) anyFreeShipping = true;
    if (r.amount > 0 && (!best || r.amount > best.amount)) {
      best = { amount: r.amount, freeShipping: r.freeShipping, label: d.name };
    }
  }

  // A valid coupon code overrides the automatic value discount.
  const code = ctx.appliedCode;
  if (code) {
    const codeAmount = valueOf(code.valueType, code.value, ctx.subtotal);
    const label = code.name || `Cupón ${code.code}`;
    return {
      amount: Math.min(codeAmount, ctx.subtotal),
      freeShipping: code.freeShipping || anyFreeShipping,
      label: codeAmount > 0 || code.freeShipping ? label : null,
      code: code.code,
    };
  }

  if (best) {
    return {
      amount: Math.min(best.amount, ctx.subtotal),
      freeShipping: best.freeShipping || anyFreeShipping,
      label: best.label,
      code: null,
    };
  }

  if (anyFreeShipping) {
    return { amount: 0, freeShipping: true, label: 'Envío gratis', code: null };
  }

  return EMPTY;
}

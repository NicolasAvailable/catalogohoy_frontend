/** A paid extra attached to a cart line. `price` is already folded into the
 *  line's unit price; kept here so the cart/order/WhatsApp can itemise it. */
export interface CartItemAddon {
  id: string;
  name: string;
  price: number;
}

export class CartItem {
  public readonly id: string;

  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly photo: string,
    public quantity: number,
    public readonly tierTitle: string | null = null,
    id?: string,
    public readonly sku: string | null = null,
    public readonly size: string | null = null,
    public readonly variantId: string | null = null,
    public readonly variantName: string | null = null,
    public readonly addons: CartItemAddon[] = []
  ) {
    this.id = id || crypto.randomUUID();
  }

  public get total(): number {
    return Math.round(this.price * this.quantity * 100) / 100;
  }

  public incrementQuantity(): CartItem {
    return new CartItem(
      this.productId,
      this.name,
      this.description,
      this.price,
      this.photo,
      this.quantity + 1,
      this.tierTitle,
      this.id,
      this.sku,
      this.size,
      this.variantId,
      this.variantName,
      this.addons
    );
  }

  public decrementQuantity(): CartItem {
    if (this.quantity <= 1) return this;
    return new CartItem(
      this.productId,
      this.name,
      this.description,
      this.price,
      this.photo,
      this.quantity - 1,
      this.tierTitle,
      this.id,
      this.sku,
      this.size,
      this.variantId,
      this.variantName,
      this.addons
    );
  }

  public static fromPrimitives(primitives: CartItemPrimitives): CartItem {
    return new CartItem(
      primitives.productId,
      primitives.name,
      primitives.description,
      primitives.price,
      primitives.photo,
      primitives.quantity,
      primitives.tierTitle ?? null,
      primitives.id,
      primitives.sku ?? null,
      primitives.size ?? null,
      primitives.variantId ?? null,
      primitives.variantName ?? null,
      primitives.addons ?? []
    );
  }
}

export interface CartItemPrimitives {
  id: string;
  productId: string;
  name: string;
  description: string;
  price: number;
  photo: string;
  quantity: number;
  tierTitle: string | null;
  sku?: string | null;
  size?: string | null;
  variantId?: string | null;
  variantName?: string | null;
  addons?: CartItemAddon[];
}

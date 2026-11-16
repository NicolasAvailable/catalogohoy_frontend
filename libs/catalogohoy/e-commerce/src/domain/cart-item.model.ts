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
    public readonly addons: CartItemAddon[] = [],
    /** Tope de unidades para esta línea = stock disponible al momento de
     *  agregar (variante/talla/producto, lo más específico). `null` = sin
     *  límite/no rastreado. Lo respeta el "+" del carrito para no pasarse. */
    public readonly maxStock: number | null = null,
    /** Precio unitario si paga en divisas (promo en divisas, ver
     *  `divisas-promo.ts`). `null` = la línea no tiene precio en divisas. */
    public readonly divisasPrice: number | null = null,
    /** La línea ya no se puede comprar (agotado, eliminado, oculto o sin esa
     *  variante/talla). Se queda en el carrito deshabilitada para que el
     *  cliente la vea y la elimine; no suma al total ni va en la orden. La
     *  revalidación la vuelve a habilitar si el producto regresa. */
    public readonly unavailable: boolean = false
  ) {
    this.id = id || crypto.randomUUID();
  }

  /** true si ya se alcanzó el tope de stock de esta línea. */
  public get isAtStockLimit(): boolean {
    return this.maxStock !== null && this.quantity >= this.maxStock;
  }

  public get total(): number {
    if (this.unavailable) return 0;
    return Math.round(this.price * this.quantity * 100) / 100;
  }

  /** Lo que se ahorra la línea si paga en divisas (0 si no aplica). */
  public get divisasSavings(): number {
    if (this.unavailable) return 0;
    if (this.divisasPrice === null || this.divisasPrice >= this.price) return 0;
    return Math.round((this.price - this.divisasPrice) * this.quantity * 100) / 100;
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
      this.addons,
      this.maxStock,
      this.divisasPrice,
      this.unavailable
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
      this.addons,
      this.maxStock,
      this.divisasPrice,
      this.unavailable
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
      primitives.addons ?? [],
      primitives.maxStock ?? null,
      primitives.divisasPrice ?? null,
      primitives.unavailable ?? false
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
  maxStock?: number | null;
  divisasPrice?: number | null;
  unavailable?: boolean;
}

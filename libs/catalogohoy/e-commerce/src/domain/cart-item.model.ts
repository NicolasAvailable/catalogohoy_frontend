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
    public readonly sku: string | null = null
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
      this.sku
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
      this.sku
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
      primitives.sku ?? null
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
}

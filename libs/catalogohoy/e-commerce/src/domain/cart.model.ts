import { CartItem } from './cart-item.model';

export class Cart {
  constructor(private readonly _items: CartItem[]) {}

  public get items(): CartItem[] {
    return this._items;
  }

  public get total(): number {
    return this._items.reduce((acc, item) => acc + item.total, 0);
  }

  public get totalItems(): number {
    return this._items.reduce((acc, item) => acc + item.quantity, 0);
  }

  public get isEmpty(): boolean {
    return this._items.length === 0;
  }

  public addItem(item: CartItem): Cart {
    const existingIndex = this._items.findIndex(
      (i) => i.productId === item.productId
    );

    if (existingIndex >= 0) {
      const updatedItems = [...this._items];
      updatedItems[existingIndex] =
        updatedItems[existingIndex].incrementQuantity();
      return new Cart(updatedItems);
    }

    return new Cart([...this._items, item]);
  }

  public removeItem(productId: string): Cart {
    return new Cart(this._items.filter((item) => item.productId !== productId));
  }

  public updateQuantity(productId: string, quantity: number): Cart {
    if (quantity <= 0) {
      return this.removeItem(productId);
    }

    const updatedItems = this._items.map((item) => {
      if (item.productId === productId) {
        return new CartItem(
          item.productId,
          item.name,
          item.description,
          item.price,
          item.photo,
          quantity,
          item.id
        );
      }
      return item;
    });

    return new Cart(updatedItems);
  }

  public incrementItem(productId: string): Cart {
    const updatedItems = this._items.map((item) => {
      if (item.productId === productId) {
        return item.incrementQuantity();
      }
      return item;
    });
    return new Cart(updatedItems);
  }

  public decrementItem(productId: string): Cart {
    const item = this._items.find((i) => i.productId === productId);
    if (!item) return this;

    if (item.quantity <= 1) {
      return this.removeItem(productId);
    }

    const updatedItems = this._items.map((i) => {
      if (i.productId === productId) {
        return i.decrementQuantity();
      }
      return i;
    });

    return new Cart(updatedItems);
  }

  public static from(items: CartItem[]): Cart {
    return new Cart(items);
  }

  public static empty(): Cart {
    return new Cart([]);
  }
}

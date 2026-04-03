import { CartItem } from './cart-item.model';

export class Cart {
  constructor(private readonly _items: CartItem[]) {}

  public get items(): CartItem[] {
    return this._items;
  }

  public get total(): number {
    const raw = this._items.reduce((acc, item) => acc + item.total, 0);
    return Math.round(raw * 100) / 100;
  }

  public get totalItems(): number {
    return this._items.reduce((acc, item) => acc + item.quantity, 0);
  }

  public get isEmpty(): boolean {
    return this._items.length === 0;
  }

  public addItem(item: CartItem): Cart {
    const existingIndex = this._items.findIndex(
      (i) => i.productId === item.productId && i.tierTitle === item.tierTitle
    );

    if (existingIndex >= 0) {
      const updatedItems = [...this._items];
      updatedItems[existingIndex] =
        updatedItems[existingIndex].incrementQuantity();
      return new Cart(updatedItems);
    }

    return new Cart([...this._items, item]);
  }

  public removeItem(itemId: string): Cart {
    return new Cart(this._items.filter((item) => item.id !== itemId));
  }

  public updateQuantity(itemId: string, quantity: number): Cart {
    if (quantity <= 0) {
      return this.removeItem(itemId);
    }

    const updatedItems = this._items.map((item) => {
      if (item.id === itemId) {
        return new CartItem(
          item.productId,
          item.name,
          item.description,
          item.price,
          item.photo,
          quantity,
          item.tierTitle,
          item.id
        );
      }
      return item;
    });

    return new Cart(updatedItems);
  }

  public incrementItem(itemId: string): Cart {
    const updatedItems = this._items.map((item) => {
      if (item.id === itemId) {
        return item.incrementQuantity();
      }
      return item;
    });
    return new Cart(updatedItems);
  }

  public decrementItem(itemId: string): Cart {
    const item = this._items.find((i) => i.id === itemId);
    if (!item) return this;

    if (item.quantity <= 1) {
      return this.removeItem(itemId);
    }

    const updatedItems = this._items.map((i) => {
      if (i.id === itemId) {
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

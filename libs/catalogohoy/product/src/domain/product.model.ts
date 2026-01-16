import { Entity } from '@shared/domain';

export class Product extends Entity {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly pricePromotional: number,
    public readonly photos: string[],
    public readonly stock: string | null,
    public readonly authUserId: string,
    public readonly createdAt: string
  ) {
    super();
  }

  public static create(primitives: ProductPrimitives) {
    return new Product(
      primitives.name,
      primitives.description,
      primitives.price,
      primitives.pricePromotional,
      primitives.photos,
      primitives.stock,
      primitives.authUserId,
      primitives.createdAt
    ).withId(primitives.id);
  }
}

export interface ProductPrimitives {
  id: string;
  name: string;
  description: string;
  price: number;
  pricePromotional: number;
  photos: string[];
  stock: string | null;
  authUserId: string;
  createdAt: string;
}

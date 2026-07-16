import { CategoryList } from '@catalogohoy/category';
import { Entity } from '@shared/domain';

export interface WholesaleTier {
  title: string;
  price: number;
}

export interface ProductSize {
  /** Label shown to the buyer, e.g. "S", "M", "L", "42". */
  name: string;
  /** Units available in this size. `null` = unlimited stock. */
  stock: number | null;
  /** Optional SKU for this specific size. */
  sku?: string | null;
}

export interface ProductVariant {
  /** Stable id used as the cart/order line identity and for de-dup. */
  id: string;
  /** Label shown to the buyer, e.g. "Verde futbol", "Azul bella". */
  name: string;
  /** Price charged for this variant (overrides the product base price). */
  price: number;
  /** Optional struck-through "before" price. `0` = none. */
  originalPrice: number;
  /** Optional SKU for this variant. */
  sku?: string | null;
  /** Own media (images and/or videos). When empty, the variant falls back to
   *  the product's media. The first item is the variant cover. */
  photos: string[];
  /** This variant's own sizes, each with its own stock. Empty = the variant
   *  has no sizes (added directly to the cart). */
  sizes: ProductSize[];
}

/**
 * Optional paid extra a buyer can ADD to a product. Unlike a variant (which
 * REPLACES the base price and is single-select), addons are multi-select and
 * their prices SUM on top of the selected variant/base price.
 */
export interface ProductAddon {
  /** Stable id used as the cart/order line identity and for de-dup. */
  id: string;
  /** Label shown to the buyer, e.g. "Corona Mediana", "Tarjeta". */
  name: string;
  /** Amount added to the price when selected. `0` = free extra. */
  price: number;
  /** Optional thumbnail. Empty = no image (a placeholder tile is shown). */
  photo?: string | null;
  /** Pre-checked when the modal opens. */
  isDefault?: boolean;
}

export class Product extends Entity {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly pricePromotional: number,
    public readonly photos: string[],
    public readonly stock: string | null,
    public readonly categoryList: CategoryList,
    public readonly authUserId: string,
    public readonly createdAt: string,
    public readonly sku: string | null,
    public readonly productionCost: number | null,
    public readonly position: number,
    public readonly isWholesale: boolean,
    public readonly wholesaleTiers: WholesaleTier[],
    public readonly isSoldOut: boolean,
    public readonly isHidden: boolean,
    public readonly isSized: boolean,
    public readonly sizes: ProductSize[],
    public readonly isVariant: boolean = false,
    public readonly variants: ProductVariant[] = [],
    public readonly addons: ProductAddon[] = []
  ) {
    super();
  }

  public static fromPrimitives(primitives: ProductPrimitives) {
    return new Product(
      primitives.name,
      primitives.description,
      primitives.price,
      primitives.pricePromotional,
      primitives.photos,
      primitives.stock,
      primitives.categoryList,
      primitives.authUserId,
      primitives.createdAt,
      primitives.sku,
      primitives.productionCost,
      primitives.position,
      primitives.isWholesale,
      primitives.wholesaleTiers,
      primitives.isSoldOut,
      primitives.isHidden,
      primitives.isSized,
      primitives.sizes,
      primitives.isVariant ?? false,
      primitives.variants ?? [],
      primitives.addons ?? []
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
  categoryList: CategoryList;
  authUserId: string;
  createdAt: string;
  sku: string | null;
  productionCost: number | null;
  position: number;
  isWholesale: boolean;
  wholesaleTiers: WholesaleTier[];
  isSoldOut: boolean;
  isHidden: boolean;
  isSized: boolean;
  sizes: ProductSize[];
  isVariant?: boolean;
  variants?: ProductVariant[];
  addons?: ProductAddon[];
}

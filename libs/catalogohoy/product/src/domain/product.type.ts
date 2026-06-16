export type CreateProductInput = {
  name: string;
  description: string | null;
  price: string;
  pricePromotional: string;
  photos: string[] | null;
  stock: string | null;
  categoryIds: string[];
  sku: string | null;
  productionCost: string | null;
  isWholesale: boolean;
  wholesaleTiers: { title: string; price: string }[];
  isSoldOut: boolean;
  isHidden: boolean;
  isSized: boolean;
  sizes: { name: string; stock: string | null; variantId?: string | null }[];
  isVariant: boolean;
  variants: {
    id: string | null;
    name: string;
    price: string;
    originalPrice: string;
    photos: string[];
  }[];
};

export type UpdateProductInput = CreateProductInput & { id: string; position?: number };

export type ReplaceCategoriesInput = {
  productIds: string[];
  categoryIds: string[];
};

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
  sizes: { name: string; stock: string | null; sku?: string | null }[];
  isVariant: boolean;
  variants: {
    id: string | null;
    name: string;
    price: string;
    originalPrice: string;
    sku?: string | null;
    photos: string[];
    sizes: { name: string; stock: string | null; sku?: string | null }[];
  }[];
  addons?: {
    id: string | null;
    name: string;
    price: string | number;
    photo?: string | null;
    isDefault?: boolean;
  }[];
};

export type UpdateProductInput = CreateProductInput & { id: string; position?: number };

export type ReplaceCategoriesInput = {
  productIds: string[];
  categoryIds: string[];
};

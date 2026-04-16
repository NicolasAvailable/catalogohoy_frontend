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
};

export type UpdateProductInput = CreateProductInput & { id: string; position?: number };

export type ReplaceCategoriesInput = {
  productIds: string[];
  categoryIds: string[];
};

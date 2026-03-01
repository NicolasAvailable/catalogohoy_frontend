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
};

export type UpdateProductInput = CreateProductInput & { id: string };

export type ReplaceCategoriesInput = {
  productIds: string[];
  categoryIds: string[];
};

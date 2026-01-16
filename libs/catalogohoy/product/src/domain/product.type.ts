export type CreateProductInput = {
  name: string;
  description: string | null;
  price: string;
  pricePromotional: string;
  photos: string[] | null;
  stock: string | null;
};

export type UpdateProductInput = CreateProductInput & { id: string };

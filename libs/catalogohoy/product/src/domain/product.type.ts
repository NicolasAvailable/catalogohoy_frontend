export type CreateProductInput = {
  name: string;
  description: string;
  price: number;
  pricePromotional: number;
  photo: string;
  stock: number | null;
};

export interface ProductEntity {
  id: string;
  name: string;
  description: string;
  price: number;
  price_promotional: number;
  auth_user_id: string;
  photos: string[];
  stock: string | null;
  created_at: string;
}

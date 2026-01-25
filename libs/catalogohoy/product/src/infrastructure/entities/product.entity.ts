import { CategoryEntity } from '@catalogohoy/category';

export interface ProductEntity {
  id: string;
  name: string;
  description: string;
  price: number;
  price_promotional: number | null;
  auth_user_id: string;
  photos: string[];
  stock: string | null;
  product_categories: CategoryEntity[];
  created_at: string;
}

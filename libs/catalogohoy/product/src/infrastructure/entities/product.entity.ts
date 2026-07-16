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
  sku: string | null;
  production_cost: number | null;
  product_categories: CategoryEntity[];
  created_at: string;
  position: number;
  is_wholesale: boolean;
  wholesale_tiers: { title: string; price: number }[];
  is_sold_out: boolean;
  is_hidden: boolean;
  is_sized?: boolean;
  sizes?: { name: string; stock: number | null; sku?: string | null }[];
  is_variant?: boolean;
  variants?: {
    id: string;
    name: string;
    price: number;
    originalPrice: number;
    sku?: string | null;
    photos: string[];
    sizes?: { name: string; stock: number | null; sku?: string | null }[];
  }[];
  addons?: {
    id: string;
    name: string;
    price: number;
    photo?: string | null;
    isDefault?: boolean;
  }[];
}

export interface CategoryEntity {
  id: string;
  name: string;
  description: string | null;
  is_visible: boolean;
  position: number;
  auth_user_id: string;
  created_at: string;
}

export type CreateCategoryInput = {
  name: string;
  description?: string;
  isVisible: boolean;
};

export type UpdateCategoryInput = {
  id: string;
  name: string;
  description?: string;
  isVisible: boolean;
};

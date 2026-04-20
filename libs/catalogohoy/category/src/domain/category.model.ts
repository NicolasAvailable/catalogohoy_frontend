import { Entity } from '@shared/domain';

export class Category extends Entity {
  constructor(
    public readonly name: string,
    public readonly description: string | null,
    public readonly isVisible: boolean,
    public readonly position: number,
    public readonly authUserId: string,
    public readonly createdAt: string,
    public readonly isViewAll: boolean = false
  ) {
    super();
  }

  public static create(primitives: CategoryPrimitives) {
    return new Category(
      primitives.name,
      primitives.description,
      primitives.isVisible,
      primitives.position,
      primitives.authUserId,
      primitives.createdAt,
      primitives.isViewAll ?? false
    ).withId(primitives.id);
  }
}

export interface CategoryPrimitives {
  id: string;
  name: string;
  description: string | null;
  isVisible: boolean;
  position: number;
  authUserId: string;
  createdAt: string;
  /** True only for the seeded "Ver todos" row. On the public catalog clicking
   *  this category clears any active filter (acts as a "show all" pill). */
  isViewAll?: boolean;
}

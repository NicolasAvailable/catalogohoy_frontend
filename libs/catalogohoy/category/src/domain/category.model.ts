import { Entity } from '@shared/domain';

export class Category extends Entity {
  constructor(
    public readonly name: string,
    public readonly description: string | null,
    public readonly isVisible: boolean,
    public readonly position: number,
    public readonly authUserId: string,
    public readonly createdAt: string
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
      primitives.createdAt
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
}

import { Entity } from '@shared/domain';

export class TenantModel extends Entity {
  constructor(
    public name: string,
    public slug: string,
    public role: string,
    public isFirst: boolean
  ) {
    super();
  }

  static create(primitives: TenantPrimitives) {
    return new TenantModel(
      primitives.name,
      primitives.slug,
      primitives.role,
      primitives.isFirst
    );
  }
}

export interface TenantPrimitives {
  name: string;
  slug: string;
  role: string;
  isFirst: boolean;
}

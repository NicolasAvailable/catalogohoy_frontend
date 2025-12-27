import { Entity } from '@shared/domain';

export class Tenant extends Entity {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly isDefault: boolean,
    public readonly role: TenantRol
  ) {
    super();
  }

  public get url(): string {
    return `https://${this.slug}.catalogohoy.com`;
  }

  static create(primitives: TenantPrimitives) {
    return new Tenant(
      primitives.name,
      primitives.slug,
      primitives.isDefault,
      primitives.role
    ).withId(primitives.id);
  }

  static empty() {
    return new Tenant('', '', false, 'member');
  }
}

export interface TenantPrimitives {
  id: number;
  name: string;
  slug: string;
  isDefault: boolean;
  role: TenantRol;
}
export type TenantRol = 'owner' | 'admin' | 'member';

import { Entity } from '@shared/domain';

export class Tenant extends Entity {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly isDefault: boolean,
    public readonly role: TenantRol,
    public readonly logo: string | null = null,
    public readonly customDomain: string | null = null
  ) {
    super();
  }

  public get url(): string {
    if (this.customDomain) {
      return `https://${this.customDomain}`;
    }
    return `https://${this.slug}.catalogohoy.com`;
  }

  static create(primitives: TenantPrimitives) {
    return new Tenant(
      primitives.name,
      primitives.slug,
      primitives.isDefault,
      primitives.role,
      primitives.logo ?? null,
      primitives.customDomain ?? null
    ).withId(primitives.id);
  }

  static empty() {
    return new Tenant('', '', false, 'member', null, null);
  }
}

export interface TenantPrimitives {
  id: number;
  name: string;
  slug: string;
  isDefault: boolean;
  role: TenantRol;
  logo?: string | null;
  customDomain?: string | null;
}
export type TenantRol = 'owner' | 'admin' | 'member';

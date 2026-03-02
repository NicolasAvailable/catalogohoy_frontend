import { TenantList } from '@catalogohoy/tenant';
import { Entity } from '@shared/domain';

export class Profile extends Entity {
  constructor(
    public name: string,
    public email: string,
    public photo: string | null,
    public tenantList: TenantList
  ) {
    super();
  }

  static empty() {
    return new Profile('', '', null, TenantList.empty());
  }

  static primitives(primitives: ProfilePrimitive) {
    return new Profile(
      primitives.name,
      primitives.email,
      primitives.photo,
      primitives.tenantList
    ).withId(primitives.id);
  }
}

export interface ProfilePrimitive {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  tenantList: TenantList;
}

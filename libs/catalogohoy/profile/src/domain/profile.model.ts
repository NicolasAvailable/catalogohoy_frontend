import { Entity } from '@shared/domain';
import { TenantList } from './tenant-list.model';

export class Profile extends Entity {
  constructor(
    public name: string,
    public email: string,
    public tenantList: TenantList
  ) {
    super();
  }

  static empty() {
    return new Profile('', '', TenantList.empty());
  }

  static primitives(primitives: ProfilePrimitive) {
    return new Profile(
      primitives.name,
      primitives.email,
      primitives.tenantList
    ).withId(primitives.id);
  }
}

export interface ProfilePrimitive {
  id: number;
  name: string;
  email: string;
  tenantList: TenantList;
}

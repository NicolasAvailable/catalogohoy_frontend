import { EntityList } from '@shared/domain';
import { Tenant } from './tenant.model';

export class TenantList extends EntityList<Tenant> {
  constructor(public readonly tenants: Tenant[]) {
    super(TenantList, tenants);
  }

  static create(tenants: Tenant[]) {
    return new TenantList(tenants);
  }

  static empty() {
    return new TenantList([]);
  }
}

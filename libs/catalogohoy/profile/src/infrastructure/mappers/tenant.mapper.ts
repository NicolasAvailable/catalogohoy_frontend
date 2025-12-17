import { Tenant, TenantList } from '../../domain';
import { TenantEntity } from '../primitives';

export class TenantListMapper {
  static toDomain(entities: TenantEntity[]) {
    return TenantList.create(
      entities.map((e) =>
        Tenant.create({
          id: e.id,
          name: e.name,
          slug: e.slug,
          isDefault: e.is_default,
          role: e.role,
        })
      )
    );
  }
}

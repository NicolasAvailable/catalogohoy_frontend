import { Tenant } from '../../domain';
import { TenantEntity } from '../entities';

export class TenantMapper {
  static toDomain(entity: TenantEntity) {
    return Tenant.create({
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      isDefault: entity.is_default,
      role: entity.role,
      logo: entity.logo ?? null,
    });
  }
}

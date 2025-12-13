import { TenantModel } from '../../domain';
import { TenantEntity } from '../entities';

export class TenantMapper {
  static toDomain(entity: TenantEntity) {
    return TenantModel.create({
      name: entity.tenant_name,
      slug: entity.slug,
      role: entity.role,
      isFirst: entity.is_default,
    });
  }
}

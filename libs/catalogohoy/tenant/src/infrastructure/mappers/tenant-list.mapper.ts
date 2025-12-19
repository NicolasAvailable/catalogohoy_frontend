import { TenantList } from '../../domain';
import { TenantEntity } from '../entities';
import { TenantMapper } from './tenant.mapper';

export class TenantListMapper {
  static toDomain(entities: TenantEntity[]) {
    return TenantList.create(entities.map((e) => TenantMapper.toDomain(e)));
  }
}

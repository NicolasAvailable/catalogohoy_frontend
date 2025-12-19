import { TenantListMapper } from '@catalogohoy/tenant';
import { Profile } from '../../domain';
import { ProfileResponse } from '../primitives';

export class ProfileMapper {
  static toDomain(profile: ProfileResponse) {
    return Profile.primitives({
      id: profile.user.id,
      name: profile.user.name,
      email: profile.user.email,
      tenantList: TenantListMapper.toDomain(profile.tenants),
    });
  }
}

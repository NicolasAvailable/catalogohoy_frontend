import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { BaseProfileService } from '../domain';
import { ProfileMapper } from './mappers';

@Injectable({
  providedIn: 'root',
})
export class ProfileService implements BaseProfileService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async profile(): Promise<Either<Error, any>> {
    const { data: profile, error } = await this.client.rpc(
      'get_my_profile_with_tenants'
    );
    console.log(profile);
    if (error) {
      return E.left(error);
    }
    return E.right(ProfileMapper.toDomain(profile));
  }
}

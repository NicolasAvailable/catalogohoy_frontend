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
    if (error) {
      return E.left(error);
    }
    return E.right(ProfileMapper.toDomain(profile));
  }

  public async updateName(name: string): Promise<Either<Error, void>> {
    const { data } = await this.client.auth.getUser();
    if (data.user === null) {
      return E.left(new Error('User not authenticated'));
    }
    const { error } = await this.client
      .from('users')
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', data.user.id)
      .select();
    if (error) {
      return E.left(error);
    }
    return E.right(undefined);
  }
}

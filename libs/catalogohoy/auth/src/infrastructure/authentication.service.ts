import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { Tenant, TenantMapper } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import { AuthApiError } from '@supabase/supabase-js';
import {
  BaseAuthenticationService,
  ForgottenPasswordCredentials,
  LoginCredentials,
  ResetPasswordCredentials,
  SignUpCredentials,
} from '../domain';
import { errorMapper } from './authentication-error';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService implements BaseAuthenticationService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async login(
    credentials: LoginCredentials
  ): Promise<E.Either<Error, Tenant>> {
    const { error } = await this.client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    }
    const { data: tenantRows, error: tenantError } = await this.client.rpc(
      'get_my_tenant'
    );
    if (tenantError) {
      return E.left(new Error(tenantError.message));
    }
    return E.right(TenantMapper.toDomain(tenantRows[0]));
  }

  public async signup(
    credentials: SignUpCredentials
  ): Promise<E.Either<Error, Tenant>> {
    const { error } = await this.client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      phone: '',
      options: {
        data: {
          name: credentials.name,
          display_name: credentials.name,
          phone: '',
          store_name: credentials.storeName,
        },
      },
    });
    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    }

    const { data: tenantRows, error: tenantError } = await this.client.rpc(
      'get_my_tenant'
    );
    if (tenantError) {
      return E.left(new Error(tenantError.message));
    }
    return E.right(TenantMapper.toDomain(tenantRows[0]));
  }

  public async forgottenPassword(input: ForgottenPasswordCredentials) {
    const { error } = await this.client.auth.resetPasswordForEmail(
      input.email,
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    } else {
      return E.right(undefined);
    }
  }

  public async resetPassword(
    input: ResetPasswordCredentials
  ): Promise<E.Either<Error, void>> {
    const { error: sessionError } = await this.client.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken || '',
    });

    if (sessionError) {
      return E.left(errorMapper(sessionError as AuthApiError));
    }

    const { error } = await this.client.auth.updateUser({
      password: input.password,
    });

    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    } else {
      return E.right(undefined);
    }
  }
}

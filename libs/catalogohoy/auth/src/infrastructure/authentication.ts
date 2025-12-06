import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { AuthApiError } from '@supabase/supabase-js';
import {
  BaseAuthenticationService,
  LoginCredentials,
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
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    } else {
      return E.right(undefined);
    }
  }

  public async signup(
    credentials: SignUpCredentials
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      phone: credentials.phone.replace(/[^\d]/g, ''),
      options: {
        data: {
          name: credentials.name,
          display_name: credentials.name,
          phone: credentials.phone.replace(/[^\d]/g, ''),
          store_name: credentials.storeName,
        },
      },
    });
    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    } else {
      return E.right(undefined);
    }
  }
}

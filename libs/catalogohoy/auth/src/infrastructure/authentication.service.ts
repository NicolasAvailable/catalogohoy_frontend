import { isDevMode, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantMapper } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import { AuthApiError } from '@supabase/supabase-js';
import {
  BaseAuthenticationService,
  ForgottenPasswordCredentials,
  GoogleSignupCredentials,
  LoginCredentials,
  ResetPasswordCredentials,
  SignUpCredentials,
} from '../domain';
import { errorMapper } from './authentication-error';
import { authenticationTokenService } from './authentication-token.service';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService implements BaseAuthenticationService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly authenticationTokenService = authenticationTokenService;

  public async login(
    credentials: LoginCredentials
  ): Promise<E.Either<Error, string>> {
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
    const tenant = TenantMapper.toDomain(tenantRows[0]);
    return E.right(this._buildRedirectUrl(tenant.slug));
  }

  public async signup(
    credentials: SignUpCredentials
  ): Promise<E.Either<Error, string>> {
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
    const tenant = TenantMapper.toDomain(tenantRows[0]);
    return E.right(this._buildRedirectUrl(tenant.slug));
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
  public async loginWithGoogle(path: string): Promise<string | null> {
    const { data } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/${path}`,
        skipBrowserRedirect: true,
      },
    });
    return data.url;
  }

  public onAuthStateChange(callback: (event: string) => void): () => void {
    const {
      data: { subscription },
    } = this.client.auth.onAuthStateChange((event) => callback(event));
    return () => subscription.unsubscribe();
  }

  public async getSession(): Promise<boolean> {
    const {
      data: { session },
    } = await this.client.auth.getSession();
    return !!session;
  }

  public async getLoginRedirectUrl(): Promise<E.Either<Error, string>> {
    const { data: tenantRows, error } = await this.client.rpc('get_my_tenant');
    if (error) return E.left(new Error(error.message));
    if (!tenantRows?.length) return E.left(new Error('no_tenant'));
    const tenant = TenantMapper.toDomain(tenantRows[0]);
    return E.right(this._buildRedirectUrl(tenant.slug));
  }

  public buildTenantAdminUrl(slug: string): string {
    return this._buildRedirectUrl(slug);
  }

  private _buildRedirectUrl(slug: string): string {
    const key = this.authenticationTokenService.AUTH_CONFIG_KEY;
    const value = encodeURIComponent(this.authenticationTokenService.authConfigValue ?? '');
    if (isDevMode()) {
      return `http://localhost:4200/admin?${key}=${value}`;
    }
    return `https://${slug}.catalogohoy.com/admin?${key}=${value}`;
  }

  public async completeGoogleSignup(
    credentials: GoogleSignupCredentials
  ): Promise<E.Either<Error, string>> {
    const { error } = await this.client.rpc('complete_google_signup', {
      p_name: credentials.name,
      p_store_name: credentials.storeName,
    });
    if (error) {
      const MSG: Record<string, string> = {
        user_not_found: 'Usuario no encontrado',
        tenant_already_exists: 'Ya tienes un catálogo registrado',
        slug_taken: 'El nombre de la tienda ya está en uso, elige otro',
        invalid_store_name: 'El nombre de la tienda no es válido',
      };
      const key = Object.keys(MSG).find((k) => error.message.includes(k));
      return E.left(new Error(key ? MSG[key] : error.message));
    }
    return this.getLoginRedirectUrl();
  }

  public async checkEmailExists(email: string): Promise<boolean> {
    const { data } = await this.client.rpc('check_email_exists', {
      p_email: email,
    });
    return data === true;
  }

  public async checkUserHasStore(): Promise<boolean> {
    const { data } = await this.client.rpc('check_user_has_store');
    return data === true;
  }

  public async logout(): Promise<E.Either<Error, void>> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }

  public async validateInviteToken(
    token: string
  ): Promise<E.Either<Error, { email: string; tenantName: string; isRegistered: boolean }>> {
    const { data, error } = await this.client.functions.invoke<{
      email: string;
      tenantName: string;
      isRegistered: boolean;
    }>('accept-team-invite', {
      body: { action: 'check', token },
    });

    if (error) return E.left(new Error(error.message));
    if (!data) return E.left(new Error('Respuesta inválida del servidor'));
    return E.right(data);
  }

  public async acceptInvite(token: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client.functions.invoke('accept-team-invite', {
      body: { token },
    });

    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  public async signupInvitee(credentials: {
    email: string;
    password: string;
    name: string;
  }): Promise<E.Either<Error, void>> {
    const { error } = await this.client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          name: credentials.name,
          display_name: credentials.name,
        },
      },
    });

    if (error) return E.left(errorMapper(error as AuthApiError));
    return E.right(undefined);
  }
}

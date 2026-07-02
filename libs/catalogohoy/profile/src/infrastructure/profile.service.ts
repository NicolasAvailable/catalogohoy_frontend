import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { BaseProfileService, NotificationPreferences } from '../domain';
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

    // Fetch logos from tenant_ecommerce_config for all tenants
    const tenantIds = profile.tenants.map((t: any) => t.id);
    if (tenantIds.length > 0) {
      const { data: configs } = await this.client
        .from('tenant_ecommerce_config')
        .select('tenant_id, logo')
        .in('tenant_id', tenantIds);

      if (configs) {
        const logoMap = new Map(
          configs.map((c: any) => [c.tenant_id, c.logo])
        );
        profile.tenants = profile.tenants.map((t: any) => ({
          ...t,
          logo: logoMap.get(t.id) ?? null,
        }));
      }
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

  public async updatePassword(password: string): Promise<Either<Error, void>> {
    const { error } = await this.client.auth.updateUser({
      password,
    });

    if (error) {
      return E.left(new Error(error.message));
    } else {
      return E.right(undefined);
    }
  }

  public async updateNotificationPreferences(
    prefs: NotificationPreferences
  ): Promise<Either<Error, void>> {
    const { data: auth } = await this.client.auth.getUser();
    if (auth.user === null) {
      return E.left(new Error('User not authenticated'));
    }
    const { error } = await this.client
      .from('users')
      .update({
        notify_plan_expiry: prefs.notifyPlanExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', auth.user.id);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  public async deleteAccount(): Promise<Either<Error, void>> {
    const { error } = await this.client.functions.invoke('delete-account');

    if (error) {
      // `functions.invoke` devuelve un error genérico ("Edge Function returned
      // a non-2xx status code") cuando la función responde 4xx/5xx. El motivo
      // real (p. ej. una violación de foreign key en el borrado) viaja en el
      // body de la respuesta, accesible vía `error.context` (una Response).
      // Lo extraemos para mostrar la causa concreta en el toast.
      let detail = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        const body = await ctx?.json?.();
        if (body?.error) {
          detail = body.error;
          if (Array.isArray(body.cleanupErrors) && body.cleanupErrors.length) {
            detail += ` (${body.cleanupErrors.join('; ')})`;
          }
        }
      } catch {
        /* si el body no es JSON, dejamos el mensaje genérico */
      }
      return E.left(new Error(detail));
    }

    await this.client.auth.signOut();
    window.location.href = 'https://auth.catalogohoy.com';
    return E.right(undefined);
  }
}

import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  CreateWhatsAppAccountPayload,
  EmbeddedSignupPayload,
  WhatsAppAccount,
  WhatsAppAccountMapper,
  WhatsAppConnectChecklist,
} from '../domain';

@Injectable({
  providedIn: 'root',
})
export class WhatsAppService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getAccountsByTenant(
    tenantId: number
  ): Promise<E.Either<Error, WhatsAppAccount[]>> {
    const { data, error } = await this.client
      .from('whatsapp_accounts')
      .select(
        'id, tenant_id, phone_number, display_name, waba_id, phone_number_id, status, created_at, updated_at'
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(WhatsAppAccountMapper.toDomainList(data || []));
  }

  async createAccount(
    tenantId: number,
    payload: CreateWhatsAppAccountPayload
  ): Promise<E.Either<Error, WhatsAppAccount>> {
    const { data, error } = await this.client
      .from('whatsapp_accounts')
      .insert({
        tenant_id: tenantId,
        phone_number: payload.phoneNumber,
        display_name: payload.displayName,
        waba_id: payload.wabaId,
        phone_number_id: payload.phoneNumberId,
        status: 'active',
      })
      .select(
        'id, tenant_id, phone_number, display_name, waba_id, phone_number_id, status, created_at, updated_at'
      )
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(WhatsAppAccountMapper.toDomain(data));
  }

  /** Completa el alta del número del comerciante vía la edge function `wa-onboard`:
   *  el intercambio del authCode por el token + la suscripción de la app a la WABA
   *  ocurren server-side (el token jamás pasa por el front). */
  async createAccountFromSignup(
    tenantId: number,
    payload: EmbeddedSignupPayload
  ): Promise<E.Either<Error, WhatsAppAccount>> {
    const { data, error } = await this.client.functions.invoke('wa-onboard', {
      body: {
        tenantId,
        wabaId: payload.wabaId,
        phoneNumberId: payload.phoneNumberId,
        authCode: payload.authCode,
      },
    });

    if (error) {
      return E.left(new Error(error.message));
    }
    if (!data?.success || !data?.account) {
      return E.left(new Error(data?.error ?? 'No se pudo conectar WhatsApp'));
    }

    return E.right(WhatsAppAccountMapper.toDomain(data.account));
  }

  /** Lista de verificación previa a conectar: Meta puede revisar el negocio
   *  durante el onboarding, así que chequeamos que el catálogo esté
   *  presentable. `is_hidden` puede ser null en filas viejas → `not is true`. */
  /** Cuenta de Instagram conectada del tenant (columnas públicas — los
   *  tokens no son visibles para el navegador por privilegios de columna). */
  async getInstagramAccount(
    tenantId: number
  ): Promise<E.Either<Error, { username: string | null; displayName: string | null } | null>> {
    return this.getSocialAccount(tenantId, 'instagram');
  }

  /** Cuenta de TikTok Business conectada del tenant (columnas públicas). */
  async getTikTokAccount(
    tenantId: number
  ): Promise<E.Either<Error, { username: string | null; displayName: string | null } | null>> {
    return this.getSocialAccount(tenantId, 'tiktok');
  }

  /** Página de Facebook (Messenger) conectada del tenant (columnas públicas). */
  async getMessengerAccount(
    tenantId: number
  ): Promise<E.Either<Error, { username: string | null; displayName: string | null } | null>> {
    return this.getSocialAccount(tenantId, 'messenger');
  }

  private async getSocialAccount(
    tenantId: number,
    channel: 'instagram' | 'tiktok' | 'messenger'
  ): Promise<E.Either<Error, { username: string | null; displayName: string | null } | null>> {
    const { data, error } = await this.client
      .from('social_accounts')
      .select('id, username, display_name, status')
      .eq('tenant_id', tenantId)
      .eq('channel', channel)
      .eq('status', 'active')
      .maybeSingle();
    if (error) return E.left(new Error(error.message));
    return E.right(
      data
        ? {
            username: (data['username'] as string | null) ?? null,
            displayName: (data['display_name'] as string | null) ?? null,
          }
        : null
    );
  }

  /** Desvincula la cuenta de IG/TikTok del tenant: solo marca status inactive
   *  (RLS permite tocar únicamente esa columna). Los chats y datos quedan. */
  async disconnectSocialAccount(
    tenantId: number,
    channel: 'instagram' | 'tiktok' | 'messenger'
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('social_accounts')
      .update({ status: 'inactive' })
      .eq('tenant_id', tenantId)
      .eq('channel', channel)
      .eq('status', 'active');
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  /** Pide a wa-onboard la URL del puente de conexión de WhatsApp
   *  (conectar.catalogohoy.com) con el state firmado del tenant. */
  async startWhatsAppConnect(
    tenantId: number,
    returnUrl: string,
    mode: 'coexistence' | 'dedicated'
  ): Promise<E.Either<Error, string>> {
    const { data, error } = await this.client.functions.invoke('wa-onboard', {
      body: { action: 'start', tenantId, returnUrl, mode },
    });
    if (!error && data?.success && data?.url) {
      return E.right(data.url as string);
    }
    const message =
      (typeof data?.error === 'string' && data.error) ||
      'No se pudo iniciar la conexión con WhatsApp';
    return E.left(new Error(message));
  }

  /** Pide a ig-oauth la URL de autorización de Instagram Login (state firmado
   *  server-side que amarra tenant + returnUrl). */
  async startInstagramConnect(
    tenantId: number,
    returnUrl: string
  ): Promise<E.Either<Error, string>> {
    const { data, error } = await this.client.functions.invoke('ig-oauth', {
      body: { tenantId, returnUrl },
    });
    if (!error && data?.success && data?.url) {
      return E.right(data.url as string);
    }
    const message =
      (typeof data?.error === 'string' && data.error) ||
      'No se pudo iniciar la conexión con Instagram';
    return E.left(new Error(message));
  }

  /** Pide a fb-oauth la URL de autorización de Facebook Login (state firmado
   *  server-side que amarra tenant + returnUrl). Al autorizar, la Página de
   *  Facebook queda conectada y sus mensajes de Messenger llegan a la bandeja. */
  async startMessengerConnect(
    tenantId: number,
    returnUrl: string
  ): Promise<E.Either<Error, string>> {
    const { data, error } = await this.client.functions.invoke('fb-oauth', {
      body: { tenantId, returnUrl },
    });
    if (!error && data?.success && data?.url) {
      return E.right(data.url as string);
    }
    const message =
      (typeof data?.error === 'string' && data.error) ||
      'No se pudo iniciar la conexión con Messenger';
    return E.left(new Error(message));
  }

  /** Pide a tiktok-oauth la URL de autorización de TikTok (state firmado
   *  server-side que amarra tenant + returnUrl). La función se implementa
   *  cuando TikTok apruebe el acceso a la Business Messaging API (beta). */
  async startTikTokConnect(
    tenantId: number,
    returnUrl: string
  ): Promise<E.Either<Error, string>> {
    const { data, error } = await this.client.functions.invoke('tiktok-oauth', {
      body: { tenantId, returnUrl },
    });
    if (!error && data?.success && data?.url) {
      return E.right(data.url as string);
    }
    const message =
      (typeof data?.error === 'string' && data.error) ||
      'No se pudo iniciar la conexión con TikTok';
    return E.left(new Error(message));
  }

  async getConnectChecklist(
    tenantId: number
  ): Promise<E.Either<Error, WhatsAppConnectChecklist>> {
    const [products, config, tenant] = await Promise.all([
      this.client
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .not('is_hidden', 'is', true),
      this.client
        .from('tenant_ecommerce_config')
        .select('is_visible')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      this.client
        .from('tenants')
        .select('custom_domain')
        .eq('id', tenantId)
        .maybeSingle(),
    ]);

    if (products.error) {
      return E.left(new Error(products.error.message));
    }

    return E.right({
      visibleProducts: products.count ?? 0,
      isCatalogPublic: config.data?.is_visible ?? true,
      hasCustomDomain: !!tenant.data?.custom_domain,
    });
  }

  async updateAccount(
    id: number,
    payload: Partial<CreateWhatsAppAccountPayload> & { status?: 'active' | 'inactive' }
  ): Promise<E.Either<Error, WhatsAppAccount>> {
    const updateData: Record<string, unknown> = {};

    if (payload.phoneNumber !== undefined) updateData['phone_number'] = payload.phoneNumber;
    if (payload.displayName !== undefined) updateData['display_name'] = payload.displayName;
    if (payload.wabaId !== undefined) updateData['waba_id'] = payload.wabaId;
    if (payload.phoneNumberId !== undefined) updateData['phone_number_id'] = payload.phoneNumberId;
    if (payload.status !== undefined) updateData['status'] = payload.status;

    updateData['updated_at'] = new Date().toISOString();

    const { data, error } = await this.client
      .from('whatsapp_accounts')
      .update(updateData)
      .eq('id', id)
      .select(
        'id, tenant_id, phone_number, display_name, waba_id, phone_number_id, status, created_at, updated_at'
      )
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(WhatsAppAccountMapper.toDomain(data));
  }

  async deleteAccount(id: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('whatsapp_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}

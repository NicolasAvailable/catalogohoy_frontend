import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  BaseCheckoutService,
  CatalogCheckoutRequest,
  CheckoutRequest,
  CheckoutSession,
  UpdateCatalogSlotsRequest,
} from '../domain';

@Injectable({ providedIn: 'root' })
export class CheckoutService implements BaseCheckoutService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async createCheckoutSession(
    request: CheckoutRequest
  ): Promise<E.Either<Error, CheckoutSession>> {
    const { data, error } = await this.client.functions.invoke<{
      url: string;
      currency?: CheckoutSession['currency'];
    }>('create-checkout-session', { body: request });

    if (error) return E.left(new Error(error.message));
    if (!data?.url) return E.left(new Error('No se recibió URL de pago'));

    return E.right({ url: data.url, currency: data.currency });
  }

  public async cancelSubscription(
    tenantId: number
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client.functions.invoke(
      'cancel-subscription',
      { body: { tenantId } }
    );

    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  public async createCatalogCheckout(
    request: CatalogCheckoutRequest
  ): Promise<E.Either<Error, CheckoutSession>> {
    const { data, error } = await this.client.functions.invoke<{ url: string }>(
      'create-catalog-checkout',
      { body: request }
    );

    if (error) return E.left(new Error(error.message));
    if (!data?.url) return E.left(new Error('No se recibió URL de pago'));
    return E.right({ url: data.url });
  }

  public async updateCatalogSlots(
    request: UpdateCatalogSlotsRequest
  ): Promise<E.Either<Error, { extraCatalogs: number }>> {
    const { data, error } = await this.client.functions.invoke<{
      success: boolean;
      extraCatalogs: number;
    }>('update-catalog-slots', { body: request });

    if (error) return E.left(new Error(error.message));
    if (!data?.success) return E.left(new Error('No se pudo actualizar los catálogos'));
    return E.right({ extraCatalogs: data.extraCatalogs });
  }
}

import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  BaseCheckoutService,
  CancelSubscriptionResult,
  CatalogCheckoutRequest,
  CheckoutRequest,
  CheckoutSession,
  PromotionCodeValidation,
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
  ): Promise<E.Either<Error, CancelSubscriptionResult>> {
    const { data, error } = await this.client.functions.invoke(
      'cancel-subscription',
      { body: { tenantId } }
    );

    if (error) return E.left(new Error(error.message));

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!parsed?.success) {
      return E.left(
        new Error(parsed?.error ?? 'No se pudo cancelar la suscripción')
      );
    }
    return E.right({
      mode: parsed.mode === 'manual' ? 'manual' : 'stripe',
      immediate: parsed.immediate === true,
      activeUntil: parsed.active_until ?? null,
    });
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

  public async validatePromotionCode(
    code: string,
    planId: string
  ): Promise<E.Either<Error, PromotionCodeValidation>> {
    const { data, error } = await this.client.functions.invoke<
      PromotionCodeValidation | { error: string }
    >('validate-promotion-code', { body: { code, planId } });

    if (error) {
      // FunctionsHttpError has the response body in `context` — read it so we
      // surface Stripe's actual reason ("código expirado", "no aplica a este
      // plan", etc.) instead of a generic "non-2xx status".
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const body = await ctx.json();
          if (body?.error) return E.left(new Error(body.error));
        } catch {
          // fall through to generic error
        }
      }
      return E.left(new Error(error.message));
    }
    if (!data || 'error' in data) {
      return E.left(new Error((data as { error?: string })?.error ?? 'Cupón inválido'));
    }
    return E.right(data);
  }
}

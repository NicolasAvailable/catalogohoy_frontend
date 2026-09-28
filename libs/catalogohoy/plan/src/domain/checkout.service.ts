import { E } from '@shared/domain';
import {
  CancelSubscriptionResult,
  CatalogCheckoutRequest,
  ChangePlanRequest,
  ChangePlanResult,
  CheckoutRequest,
  CheckoutSession,
  PromotionCodeValidation,
  UpdateCatalogSlotsRequest,
} from './checkout.model';

export abstract class BaseCheckoutService {
  abstract createCheckoutSession(
    request: CheckoutRequest
  ): Promise<E.Either<Error, CheckoutSession>>;

  /** Upgrade con prorrateo: cobra solo la diferencia sobre la suscripción
   *  existente. Devuelve `no_active_subscription` / `not_an_upgrade` cuando el
   *  caso debe resolverse por el checkout normal. */
  abstract changePlan(
    request: ChangePlanRequest
  ): Promise<E.Either<Error, ChangePlanResult>>;

  abstract cancelSubscription(
    tenantId: number
  ): Promise<E.Either<Error, CancelSubscriptionResult>>;

  abstract createCatalogCheckout(
    request: CatalogCheckoutRequest
  ): Promise<E.Either<Error, CheckoutSession>>;

  abstract updateCatalogSlots(
    request: UpdateCatalogSlotsRequest
  ): Promise<E.Either<Error, { extraCatalogs: number }>>;

  abstract validatePromotionCode(
    code: string,
    planId: string
  ): Promise<E.Either<Error, PromotionCodeValidation>>;
}

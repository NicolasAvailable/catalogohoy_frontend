import { E } from '@shared/domain';
import {
  CatalogCheckoutRequest,
  CheckoutRequest,
  CheckoutSession,
  PromotionCodeValidation,
  UpdateCatalogSlotsRequest,
} from './checkout.model';

export abstract class BaseCheckoutService {
  abstract createCheckoutSession(
    request: CheckoutRequest
  ): Promise<E.Either<Error, CheckoutSession>>;

  abstract cancelSubscription(
    tenantId: number
  ): Promise<E.Either<Error, void>>;

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

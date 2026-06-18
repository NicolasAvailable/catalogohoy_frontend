import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import {
  CouponProduct,
  CreateCouponInput,
  PromotionCodeRow,
} from './coupons.model';

const FN = 'manage-stripe-coupons';

@Injectable({ providedIn: 'root' })
export class CouponsService {
  private readonly client = SupabaseClientProvider.getInstance();

  private async invoke<T>(
    body: Record<string, unknown>
  ): Promise<Either<Error, T>> {
    const { data, error } = await this.client.functions.invoke<
      T | { error: string }
    >(FN, { body });

    if (error) {
      // FunctionsHttpError keeps the response body in `context` — read it so we
      // surface Stripe's actual reason instead of a generic "non-2xx status".
      let message = error.message;
      try {
        const ctx = (error as unknown as { context?: Response }).context;
        if (ctx) {
          const parsed = await ctx.json();
          if (parsed?.error) message = parsed.error;
        }
      } catch {
        /* keep original */
      }
      return E.left(new Error(message));
    }
    if (data && typeof data === 'object' && 'error' in data) {
      return E.left(new Error((data as { error: string }).error));
    }
    return E.right(data as T);
  }

  listProducts(): Promise<Either<Error, { products: CouponProduct[] }>> {
    return this.invoke({ action: 'list_products' });
  }

  listCoupons(): Promise<
    Either<Error, { promotionCodes: PromotionCodeRow[] }>
  > {
    return this.invoke({ action: 'list_coupons' });
  }

  create(
    input: CreateCouponInput
  ): Promise<Either<Error, { coupon: unknown; promotionCode: unknown }>> {
    return this.invoke({ action: 'create', ...input });
  }

  deactivate(
    promotionCodeId: string
  ): Promise<Either<Error, { promotionCode: unknown }>> {
    return this.invoke({ action: 'deactivate', promotionCodeId });
  }
}

import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { ExchangeRate, RateType } from '../domain/rate';

@Injectable({
  providedIn: 'root',
})
export class RateService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getRates(): Promise<E.Either<Error, ExchangeRate>> {
    const { data, error } = await this.client
      .from('exchange_rates')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      return E.left(new Error(error.message));
    }

    if (!data) {
      return E.right({
        id: 1,
        bcv_usd: 0,
        bcv_eur: 0,
        custom_rate: 0,
        active_rate: 'bcv_usd',
      });
    }

    return E.right(data as ExchangeRate);
  }

  async updateActiveRate(rateType: RateType): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('exchange_rates')
      .update({ active_rate: rateType, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }

  async updateCustomRate(rate: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('exchange_rates')
      .update({ custom_rate: rate, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }

  async syncBcvRates(): Promise<E.Either<Error, void>> {
    // Mocking BCV update (replace with real API call if needed)
    const mockBcvUsd = 38.45;
    const mockBcvEur = 45.12;

    const { error } = await this.client
      .from('exchange_rates')
      .update({
        bcv_usd: mockBcvUsd,
        bcv_eur: mockBcvEur,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}

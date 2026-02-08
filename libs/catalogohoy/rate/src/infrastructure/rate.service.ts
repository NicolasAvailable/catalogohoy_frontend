import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { ExchangeRate, RateType } from '../domain/rate';

@Injectable({
  providedIn: 'root',
})
export class RateService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getRates(tenantId: number): Promise<E.Either<Error, ExchangeRate>> {
    const { data, error } = await this.client
      .from('exchange_rates')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      return E.left(new Error(error.message));
    }

    if (!data) {
      // Default rates if none exist
      return E.right({
        bcv_usd: 0,
        bcv_eur: 0,
        custom_rate: 0,
        active_rate: 'bcv_usd',
      });
    }

    return E.right(data as ExchangeRate);
  }

  async updateActiveRate(
    tenantId: number,
    rateType: RateType
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client.from('exchange_rates').upsert(
      {
        tenant_id: tenantId,
        active_rate: rateType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }

  async updateCustomRate(
    tenantId: number,
    rate: number
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client.from('exchange_rates').upsert(
      {
        tenant_id: tenantId,
        custom_rate: rate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }

  async syncBcvRates(tenantId: number): Promise<E.Either<Error, ExchangeRate>> {
    // This could call an edge function or a public API.
    // For now, let's pretend we fetch them and update the DB.
    // In a real scenario, this logic might be in the backend.
    const mockBcvUsd = 38.11; // Example BCV rate
    const mockBcvEur = 44.98;

    const { data, error } = await this.client
      .from('exchange_rates')
      .upsert(
        {
          tenant_id: tenantId,
          bcv_usd: mockBcvUsd,
          bcv_eur: mockBcvEur,
          last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )
      .select()
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(data as ExchangeRate);
  }
}

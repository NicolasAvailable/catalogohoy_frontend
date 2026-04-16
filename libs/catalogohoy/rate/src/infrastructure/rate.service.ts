import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { ExchangeRate, RateType } from '../domain/rate';

@Injectable({
  providedIn: 'root',
})
export class RateService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getRates(tenantId: string): Promise<E.Either<Error, ExchangeRate>> {
    const { data: globalRates, error: globalError } = await this.client
      .from('exchange_rates')
      .select('bcv_usd, bcv_eur')
      .eq('id', 1)
      .maybeSingle();

    if (globalError) {
      return E.left(new Error(globalError.message));
    }

    const { data: tenantConfig } = await this.client
      .from('tenant_currency_config')
      .select('exchange_rate_type, custom_rate')
      .eq('tenant_id', Number(tenantId))
      .maybeSingle();

    const rawRate = tenantConfig?.exchange_rate_type as string | null;
    const validRates: RateType[] = ['bcv_usd', 'bcv_eur', 'custom'];
    const activeRate: RateType = rawRate && validRates.includes(rawRate as RateType)
      ? (rawRate as RateType)
      : 'bcv_usd';

    return E.right({
      id: 1,
      bcv_usd: globalRates?.bcv_usd ?? 0,
      bcv_eur: globalRates?.bcv_eur ?? 0,
      custom_rate: tenantConfig?.custom_rate ?? 0,
      active_rate: activeRate,
    });
  }

  async updateActiveRate(tenantId: string, rateType: RateType): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('tenant_currency_config')
      .upsert(
        {
          tenant_id: Number(tenantId),
          exchange_rate_type: rateType,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }

  async updateCustomRate(tenantId: string, rate: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('tenant_currency_config')
      .upsert(
        {
          tenant_id: Number(tenantId),
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

  async syncBcvRates(): Promise<E.Either<Error, void>> {
    const { data: bcvRate, error: bcvError } = await this.client
      .from('bcv_rates')
      .select('usd, eur')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bcvError) {
      return E.left(new Error(bcvError.message));
    }

    if (!bcvRate) {
      return E.left(new Error('No hay tasas BCV disponibles'));
    }

    const { error } = await this.client
      .from('exchange_rates')
      .update({
        bcv_usd: bcvRate.usd,
        bcv_eur: bcvRate.eur,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}

import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';

// Client for the countries-proxy Edge Function. In-memory cache keyed by
// `country` / `country+state` so the editor never re-hits the function
// during a single session. Admin-editor only — never invoked from the
// public catalog hot path.
@Injectable({ providedIn: 'root' })
export class LocationApiService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly statesCache = new Map<string, string[]>();
  private readonly citiesCache = new Map<string, string[]>();

  async getStates(country: string): Promise<E.Either<Error, string[]>> {
    const cached = this.statesCache.get(country);
    if (cached) return E.right(cached);

    const { data, error } = await this.client.functions.invoke<{
      states?: string[];
      error?: string;
    }>('countries-proxy', {
      body: { action: 'states', country },
    });

    if (error) return E.left(new Error(error.message));
    if (!data || data.error) return E.left(new Error(data?.error ?? 'states_failed'));

    const states = data.states ?? [];
    this.statesCache.set(country, states);
    return E.right(states);
  }

  async getCities(country: string, state: string): Promise<E.Either<Error, string[]>> {
    const key = `${country}::${state}`;
    const cached = this.citiesCache.get(key);
    if (cached) return E.right(cached);

    const { data, error } = await this.client.functions.invoke<{
      cities?: string[];
      error?: string;
    }>('countries-proxy', {
      body: { action: 'cities', country, state },
    });

    if (error) return E.left(new Error(error.message));
    if (!data || data.error) return E.left(new Error(data?.error ?? 'cities_failed'));

    const cities = data.cities ?? [];
    this.citiesCache.set(key, cities);
    return E.right(cities);
  }
}

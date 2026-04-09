import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import * as E from '@sweet-monads/either';
import { AnalyticsData } from '../domain';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getAnalytics(): Promise<E.Either<Error, AnalyticsData>> {
    // The slug must come from the URL (subdomain in prod / path in dev),
    // not from localStorage — `localStorage.slug` is only set when the
    // user followed the legacy `?slug=...` flow, so any user that landed
    // directly on `<slug>.catalogohoy.com/admin` would otherwise hit the
    // edge function with an empty slug and get all-zero analytics.
    const slug = getTenantSlugFromUrl() ?? '';
    const { data, error } = await this.client.functions.invoke<AnalyticsData>(
      'posthog-analytics',
      { body: { slug } }
    );
    if (error) return E.left(new Error(error.message));
    return E.right(data!);
  }
}

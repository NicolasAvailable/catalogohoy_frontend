import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import * as E from '@sweet-monads/either';
import { AnalyticsData } from '../domain';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getAnalytics(): Promise<E.Either<Error, AnalyticsData>> {
    const { data, error } = await this.client.functions.invoke<AnalyticsData>(
      'posthog-analytics'
    );
    if (error) return E.left(new Error(error.message));
    return E.right(data!);
  }
}

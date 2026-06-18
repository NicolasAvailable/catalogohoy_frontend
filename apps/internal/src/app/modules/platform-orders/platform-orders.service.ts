import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { PlatformOrderStats } from './platform-orders.model';

@Injectable({ providedIn: 'root' })
export class PlatformOrdersService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getStats(): Promise<Either<Error, PlatformOrderStats>> {
    const { data, error } = await this.client.rpc(
      'platform_orders_stats_admin'
    );
    if (error) return E.left(new Error(error.message));
    return E.right(data as PlatformOrderStats);
  }
}

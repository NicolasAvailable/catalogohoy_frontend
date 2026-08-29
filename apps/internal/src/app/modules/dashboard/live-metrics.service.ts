import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';

/** Métricas de ingresos REALES (Stripe + planes manuales) que arma la edge
 *  function `admin-revenue-metrics`. Reemplaza los KPIs que salían del ledger
 *  `tenant_subscriptions` (incompleto: no registra renovaciones de Stripe ni
 *  la mayoría de los pagos manuales). Ver la edge fn para el detalle. */
export interface LiveRevenueMetrics {
  asOf: string;
  monthStart: string;
  mrrUsd: number;
  arrUsd: number;
  collectedThisMonthUsd: number;
  newSubsThisMonth: number;
  stripe: {
    mrrUsd: number;
    activeCount: number;
    collectedThisMonthUsd: number;
    newThisMonth: number;
    skippedNonUsd: number;
  };
  manual: {
    mrrUsd: number;
    activeCount: number;
    collectedThisMonthUsd: number;
    newThisMonth: number;
    missingAmount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class LiveMetricsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Gated a admin interno dentro de la edge function (JWT + _assert_internal_admin). */
  async getMetrics(): Promise<Either<Error, LiveRevenueMetrics>> {
    const { data, error } =
      await this.client.functions.invoke<LiveRevenueMetrics>(
        'admin-revenue-metrics'
      );
    if (error) return E.left(new Error(error.message));
    const payload = data as LiveRevenueMetrics & { error?: string };
    if (payload?.error) return E.left(new Error(payload.error));
    return E.right(payload);
  }
}

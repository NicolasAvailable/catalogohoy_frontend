import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { CoreBusinessMetrics } from './business-metrics.model';

@Injectable({ providedIn: 'root' })
export class BusinessMetricsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Agregados de la base: altas/mes, comercios activos, mix de planes, pagos. */
  async core(): Promise<Either<Error, CoreBusinessMetrics>> {
    const { data, error } = await this.client.rpc('business_metrics_admin');
    if (error) return E.left(new Error(error.message));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (data ?? {}) as any;
    return E.right({
      monthStart: d.monthStart ?? '',
      signups: d.signups ?? { thisMonth: 0, prevMonth: 0, series: [] },
      activeMerchants: d.activeMerchants ?? { thisMonth: 0, prevMonth: 0, series: [] },
      planMix: d.planMix ?? [],
      payingCount: d.payingCount ?? 0,
    });
  }

  /** OpEx mensual: gastos de la empresa, anuales prorrateados /12. */
  async opexMonthlyUsd(): Promise<Either<Error, number>> {
    const { data, error } = await this.client.rpc('list_business_expenses_admin');
    if (error) return E.left(new Error(error.message));
    const rows = (data as { amount_usd: number; period: string }[]) ?? [];
    const monthly = rows.reduce(
      (s, r) =>
        s + (r.period === 'yearly' ? Number(r.amount_usd) / 12 : Number(r.amount_usd)),
      0
    );
    return E.right(monthly);
  }
}

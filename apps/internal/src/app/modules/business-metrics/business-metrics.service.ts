import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import {
  CoreBusinessMetrics,
  MrrMovement,
  TrialFunnel,
} from './business-metrics.model';

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
      signups: d.signups ?? { thisMonth: 0, prevMonth: 0, prevMonthToDate: 0, series: [] },
      activeMerchants: d.activeMerchants ?? { thisMonth: 0, prevMonth: 0, prevMonthToDate: 0, series: [] },
      planMix: d.planMix ?? [],
      payingCount: d.payingCount ?? 0,
    });
  }

  /** Movimiento de MRR (new/expansion/contraction/churn) + NRR entre snapshots. */
  async movement(): Promise<Either<Error, MrrMovement>> {
    const { data, error } = await this.client.rpc('mrr_movement_admin');
    if (error) return E.left(new Error(error.message));
    return E.right((data ?? { ready: false }) as MrrMovement);
  }

  /** Costo de IA del mes en USD (estimado por feature según el proveedor). */
  async aiCostMonthlyUsd(): Promise<Either<Error, number>> {
    const { data, error } = await this.client.rpc('ai_cost_monthly_admin');
    if (error) return E.left(new Error(error.message));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return E.right(Number((data as any)?.monthUsd ?? 0));
  }

  /** Embudo de prueba gratis: iniciaron / en trial / convirtieron. */
  async trialFunnel(): Promise<Either<Error, TrialFunnel>> {
    const { data, error } = await this.client.rpc('trial_funnel_admin');
    if (error) return E.left(new Error(error.message));
    return E.right(
      (data ?? { started: 0, inTrial: 0, converted: 0, conversionPct: 0 }) as TrialFunnel
    );
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

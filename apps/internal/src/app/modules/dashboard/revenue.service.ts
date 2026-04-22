import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';

export interface RevenuePoint {
  monthStart: string;
  /** Sum of amount_usd of subs activated that month (cash-in). */
  cashReceived: number;
  /** MRR: sum of monthly-equivalent amount of subs active that month. */
  mrrNormalized: number;
  /** Annual run-rate projection (mrrNormalized × 12). */
  arrProjected: number;
  activeSubs: number;
  newSubs: number;
}

interface RevenueRow {
  month_start: string;
  cash_received: string | number;
  mrr_normalized: string | number;
  arr_projected: string | number;
  active_subs: number;
  new_subs: number;
}

@Injectable({ providedIn: 'root' })
export class RevenueService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getMetrics(months = 12): Promise<Either<Error, RevenuePoint[]>> {
    const { data, error } = await this.client.rpc(
      'get_revenue_metrics_admin',
      { p_months: months }
    );

    if (error) {
      return E.left(new Error(error.message));
    }

    const points: RevenuePoint[] = ((data as RevenueRow[]) ?? []).map((row) => ({
      monthStart: row.month_start,
      cashReceived: Number(row.cash_received) || 0,
      mrrNormalized: Number(row.mrr_normalized) || 0,
      arrProjected: Number(row.arr_projected) || 0,
      activeSubs: Number(row.active_subs) || 0,
      newSubs: Number(row.new_subs) || 0,
    }));

    return E.right(points);
  }
}

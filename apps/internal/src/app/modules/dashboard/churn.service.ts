import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';

export interface ChurnPoint {
  monthStart: string;
  /** Tenants de pago activos al inicio del mes (base del churn). */
  activeStart: number;
  /** De esa base, cuántos ya no tienen sub vigente al fin del mes. */
  churned: number;
  retained: number;
  /** Nuevos o reactivados durante el mes. */
  newReactivated: number;
  activeEnd: number;
  /** churned / activeStart × 100. */
  churnRate: number;
}

interface ChurnRow {
  month_start: string;
  active_start: number;
  churned: number;
  retained: number;
  new_reactivated: number;
  active_end: number;
  churn_rate: string | number;
}

@Injectable({ providedIn: 'root' })
export class ChurnService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Churn mensual de clientes de pago (nivel tenant). El mes en curso mide el
   *  churn "hasta hoy" (snapshot capado a now() en el RPC), no proyectado. */
  async getMetrics(months = 12): Promise<Either<Error, ChurnPoint[]>> {
    const { data, error } = await this.client.rpc('get_churn_metrics_admin', {
      p_months: months,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    const points: ChurnPoint[] = ((data as ChurnRow[]) ?? []).map((row) => ({
      monthStart: row.month_start,
      activeStart: Number(row.active_start) || 0,
      churned: Number(row.churned) || 0,
      retained: Number(row.retained) || 0,
      newReactivated: Number(row.new_reactivated) || 0,
      activeEnd: Number(row.active_end) || 0,
      churnRate: Number(row.churn_rate) || 0,
    }));

    return E.right(points);
  }
}

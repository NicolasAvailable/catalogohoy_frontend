import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import {
  ChurnSummary,
  CoreBusinessMetrics,
  DemoTenant,
  MrrMovement,
  SignupConversion,
  TrialFunnel,
} from './business-metrics.model';

export interface OpexBreakdown {
  /** Recurrentes normalizados a un mes (anuales /12). */
  recurringUsd: number;
  /** Pagos únicos cargados para el mes en curso. */
  oneTimeThisMonthUsd: number;
}

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
      demoCount: d.demoCount ?? 0,
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

  /** OpEx: gastos de la empresa. Recurrentes (anuales prorrateados /12) +
   *  pagos únicos del mes en curso (antes los únicos se sumaban como mensuales). */
  async opex(): Promise<Either<Error, OpexBreakdown>> {
    const { data, error } = await this.client.rpc('list_business_expenses_v2_admin');
    if (error) return E.left(new Error(error.message));
    const rows =
      (data as { amount_usd: number | string; period: string; expense_month?: string | null }[]) ?? [];
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let recurringUsd = 0;
    let oneTimeThisMonthUsd = 0;
    for (const r of rows) {
      const amt = Number(r.amount_usd) || 0;
      if (r.period === 'one_time') {
        if ((r.expense_month ?? '').slice(0, 7) === monthKey) oneTimeThisMonthUsd += amt;
      } else {
        recurringUsd += r.period === 'yearly' ? amt / 12 : amt;
      }
    }
    return E.right({ recurringUsd, oneTimeThisMonthUsd });
  }

  /** Registros por día (últimos N días) y cuántos ya pagan. */
  async signupConversion(days = 30): Promise<Either<Error, SignupConversion>> {
    const { data, error } = await this.client.rpc('signup_conversion_daily_admin', {
      p_days: days,
    });
    if (error) return E.left(new Error(error.message));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (data ?? {}) as any;
    return E.right({
      days: Number(d.days ?? days),
      signups: Number(d.signups ?? 0),
      converted: Number(d.converted ?? 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      series: ((d.series ?? []) as any[]).map((p) => ({
        day: String(p.day),
        signups: Number(p.signups ?? 0),
        converted: Number(p.converted ?? 0),
      })),
    });
  }

  /** Churn claro por catálogo (mes en curso + mes anterior). */
  async churnSummary(): Promise<Either<Error, ChurnSummary>> {
    const { data, error } = await this.client.rpc('churn_summary_admin');
    if (error) return E.left(new Error(error.message));
    const d = (data ?? {}) as Partial<ChurnSummary>;
    return E.right({ thisMonth: d.thisMonth ?? null, lastMonth: d.lastMonth ?? null });
  }

  /** Catálogos marcados como demo/prueba. */
  async demoTenants(): Promise<Either<Error, DemoTenant[]>> {
    const { data, error } = await this.client.rpc('list_demo_tenants_admin');
    if (error) return E.left(new Error(error.message));
    return E.right(
      ((data as { id: number; name: string | null; slug: string | null; plan_id: string | null; owner_email: string | null }[]) ?? []).map(
        (r) => ({ id: r.id, name: r.name, slug: r.slug, planId: r.plan_id, ownerEmail: r.owner_email })
      )
    );
  }

  async setDemo(tenantId: number, isDemo: boolean): Promise<Either<Error, void>> {
    const { error } = await this.client.rpc('set_tenant_demo_admin', {
      p_tenant_id: tenantId,
      p_is_demo: isDemo,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }
}

import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { AiUsageService } from '../ai-usage/ai-usage.service';
import { ChurnService } from '../dashboard/churn.service';
import { LiveMetricsService } from '../dashboard/live-metrics.service';
import { PlatformOrdersService } from '../platform-orders/platform-orders.service';
import { WhatsappLogsService } from '../whatsapp-logs/whatsapp-logs.service';
import { BusinessMetrics } from './business-metrics.model';
import { BusinessMetricsService } from './business-metrics.service';

type BusinessMetricsState = {
  metrics: BusinessMetrics | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: BusinessMetricsState = {
  metrics: null,
  isLoading: false,
  error: null,
};

/** Mes actual como 'YYYY-MM' (para matchear los meses de facturación Meta). */
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const BusinessMetricsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      service = inject(BusinessMetricsService),
      live = inject(LiveMetricsService),
      churnSvc = inject(ChurnService),
      ordersSvc = inject(PlatformOrdersService),
      waSvc = inject(WhatsappLogsService),
      aiSvc = inject(AiUsageService)
    ) => ({
      async load(): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        const [coreR, liveR, opexR, churnR, ordersR, waR, aiR, moveR, trialR] =
          await Promise.all([
            service.core(),
            live.getMetrics(),
            service.opexMonthlyUsd(),
            churnSvc.getMetrics(12),
            ordersSvc.getStats(),
            waSvc.stats(),
            aiSvc.stats(),
            service.movement(),
            service.trialFunnel(),
          ]);

        // Núcleo (bloquea si falla): ingresos + agregados.
        let error: string | null = null;
        const core = coreR.isRight()
          ? coreR.value
          : ((error = coreR.value.message), null);
        const rev = liveR.isRight()
          ? liveR.value
          : ((error = error ?? liveR.value.message), null);

        // Secundarias: si fallan, 0/vacío y seguimos (no rompen el tablero).
        const opex = opexR.isRight() ? opexR.value : 0;
        const churnPts = churnR.isRight() ? churnR.value : [];
        const orders = ordersR.isRight() ? ordersR.value : null;
        const wa = waR.isRight() ? waR.value : null;
        const ai = aiR.isRight() ? aiR.value : null;
        const movement = moveR.isRight() ? moveR.value : { ready: false };
        const trialFunnel = trialR.isRight()
          ? trialR.value
          : { started: 0, inTrial: 0, converted: 0, conversionPct: 0 };

        if (core && rev) {
          const mrr = rev.mrrUsd;
          const paying =
            core.payingCount ||
            rev.stripe.activeCount + rev.manual.activeCount;
          const stripeFees = rev.stripeFeesThisMonthUsd ?? 0;
          const waCost =
            wa?.months?.find((m) => m.month === currentMonthKey())?.cost ??
            wa?.months?.[wa.months.length - 1]?.cost ??
            0;
          const churnRate = churnPts.length
            ? churnPts[churnPts.length - 1].churnRate
            : 0;

          const variableCosts = waCost + stripeFees;
          const contributionMargin = mrr - variableCosts;
          const ebitda = contributionMargin - opex;

          patchState(store, {
            metrics: {
              mrrUsd: mrr,
              arrUsd: rev.arrUsd,
              collectedThisMonthUsd: rev.collectedThisMonthUsd,
              payingCount: paying,
              arpaUsd: paying > 0 ? mrr / paying : 0,
              signups: core.signups,
              activeMerchants: core.activeMerchants,
              planMix: core.planMix,
              gmvUsd: orders?.revenueUsd ?? 0,
              completedOrders: orders?.completed ?? 0,
              churnRatePct: churnRate,
              opexMonthlyUsd: opex,
              whatsappCostUsd: waCost,
              stripeFeesUsd: stripeFees,
              aiCredits: ai?.totalCredits ?? 0,
              variableCostsUsd: variableCosts,
              contributionMarginUsd: contributionMargin,
              contributionMarginPct: mrr > 0 ? contributionMargin / mrr : 0,
              ebitdaUsd: ebitda,
              ebitdaPct: mrr > 0 ? ebitda / mrr : 0,
              movement,
              trialFunnel,
            },
          });
        }

        patchState(store, { isLoading: false, error });
      },
    })
  )
);

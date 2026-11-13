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
        const [coreR, liveR, opexR, churnR, ordersR, waR, aiR, aiCostR, moveR, trialR, convR, churnSumR, demoR] =
          await Promise.all([
            service.core(),
            live.getMetrics(),
            service.opex(),
            churnSvc.getMetrics(12),
            ordersSvc.getStats(),
            waSvc.stats(),
            aiSvc.stats(),
            service.aiCostMonthlyUsd(),
            service.movement(),
            service.trialFunnel(),
            service.signupConversion(30),
            service.churnSummary(),
            service.demoTenants(),
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
        const opexB = opexR.isRight()
          ? opexR.value
          : { recurringUsd: 0, oneTimeThisMonthUsd: 0 };
        const opex = opexB.recurringUsd;
        const opexOneTime = opexB.oneTimeThisMonthUsd;
        // Si los RPCs nuevos aún no existen (migración sin aplicar) → null/[].
        const conversion = convR.isRight() ? convR.value : null;
        const churnSummary = churnSumR.isRight() ? churnSumR.value : null;
        const demoTenants = demoR.isRight() ? demoR.value : [];
        const churnPts = churnR.isRight() ? churnR.value : [];
        const orders = ordersR.isRight() ? ordersR.value : null;
        const wa = waR.isRight() ? waR.value : null;
        const ai = aiR.isRight() ? aiR.value : null;
        const aiCost = aiCostR.isRight() ? aiCostR.value : 0;
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
          // Churn: preferimos el de las fotos de MRR (claro, por catálogo); si no
          // está, el del ledger tenant_subscriptions (incompleto).
          const churnRate =
            churnSummary?.thisMonth?.churnRatePct ??
            (churnPts.length ? churnPts[churnPts.length - 1].churnRate : 0);

          const variableCosts = waCost + stripeFees + aiCost;
          const contributionMargin = mrr - variableCosts;
          const ebitda = contributionMargin - opex - opexOneTime;

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
              opexOneTimeUsd: opexOneTime,
              whatsappCostUsd: waCost,
              stripeFeesUsd: stripeFees,
              aiCredits: ai?.totalCredits ?? 0,
              aiCostUsd: aiCost,
              variableCostsUsd: variableCosts,
              contributionMarginUsd: contributionMargin,
              contributionMarginPct: mrr > 0 ? contributionMargin / mrr : 0,
              ebitdaUsd: ebitda,
              ebitdaPct: mrr > 0 ? ebitda / mrr : 0,
              profitPerAccountUsd: paying > 0 ? ebitda / paying : 0,
              movement,
              trialFunnel,
              topPayers: rev.topPayers ?? [],
              conversion,
              churn: churnSummary,
              demoTenants,
              stripeMrrUsd: rev.stripe.mrrUsd,
              manualMrrUsd: rev.manual.mrrUsd,
            },
          });
        }

        patchState(store, { isLoading: false, error });
      },

      /** Quita la marca demo de un catálogo y recarga las métricas. */
      async unmarkDemo(tenantId: number): Promise<void> {
        const r = await service.setDemo(tenantId, false);
        if (r.isLeft()) {
          patchState(store, { error: r.value.message });
          return;
        }
        await this.load();
      },
    })
  )
);

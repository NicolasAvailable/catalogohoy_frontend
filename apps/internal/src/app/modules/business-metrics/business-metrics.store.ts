import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { LiveMetricsService } from '../dashboard/live-metrics.service';
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

export const BusinessMetricsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      service = inject(BusinessMetricsService),
      live = inject(LiveMetricsService)
    ) => ({
      async load(): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        const [coreR, liveR, opexR] = await Promise.all([
          service.core(),
          live.getMetrics(),
          service.opexMonthlyUsd(),
        ]);

        let error: string | null = null;
        const core = coreR.isRight()
          ? coreR.value
          : ((error = coreR.value.message), null);
        const rev = liveR.isRight()
          ? liveR.value
          : ((error = error ?? liveR.value.message), null);
        const opex = opexR.isRight()
          ? opexR.value
          : ((error = error ?? opexR.value.message), 0);

        if (core && rev) {
          const mrr = rev.mrrUsd;
          const paying =
            core.payingCount ||
            rev.stripe.activeCount + rev.manual.activeCount;
          const margin = mrr - opex;
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
              opexMonthlyUsd: opex,
              contributionMarginUsd: margin,
              contributionMarginPct: mrr > 0 ? margin / mrr : 0,
            },
          });
        }

        patchState(store, { isLoading: false, error });
      },
    })
  )
);

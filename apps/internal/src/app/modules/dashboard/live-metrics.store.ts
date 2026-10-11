import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { LiveMetricsService, LiveRevenueMetrics } from './live-metrics.service';

type LiveMetricsState = {
  metrics: LiveRevenueMetrics | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: LiveMetricsState = {
  metrics: null,
  isLoading: false,
  error: null,
};

/** Ingresos reales (Stripe + manual) para los KPIs del Inicio. Una sola llamada
 *  a la edge fn; los datos viven acá para que las tarjetas los consuman. */
export const LiveMetricsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, service = inject(LiveMetricsService)) => ({
    async load(): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      const result = await service.getMetrics();
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (metrics) => patchState(store, { metrics, isLoading: false })
      );
    },
  }))
);

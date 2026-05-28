import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { RevenuePoint, RevenueService } from './revenue.service';

type RevenueState = {
  points: RevenuePoint[];
  isLoading: boolean;
  error: string | null;
};

const initialState: RevenueState = {
  points: [],
  isLoading: false,
  error: null,
};

const last = (points: RevenuePoint[]): RevenuePoint | null =>
  points.length ? points[points.length - 1] : null;

export const RevenueStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    currentCashReceived: computed(() => last(store.points())?.cashReceived ?? 0),
    currentMrr: computed(() => last(store.points())?.mrrNormalized ?? 0),
    currentArr: computed(() => last(store.points())?.arrProjected ?? 0),
    currentActiveSubs: computed(() => last(store.points())?.activeSubs ?? 0),
    currentNewSubs: computed(() => last(store.points())?.newSubs ?? 0),
    mrrGrowthPct: computed(() => {
      const points = store.points();
      if (points.length < 2) return 0;
      const prev = points[points.length - 2].mrrNormalized;
      const curr = points[points.length - 1].mrrNormalized;
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    }),
    cashGrowthPct: computed(() => {
      const points = store.points();
      if (points.length < 2) return 0;
      const prev = points[points.length - 2].cashReceived;
      const curr = points[points.length - 1].cashReceived;
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    }),
  })),
  withMethods((store, service = inject(RevenueService)) => ({
    async load(months = 12) {
      patchState(store, { isLoading: true, error: null });
      const result = await service.getMetrics(months);
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (points) => patchState(store, { points, isLoading: false })
      );
    },
  }))
);

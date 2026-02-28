import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { AnalyticsData } from '../domain';
import { AnalyticsService } from './analytics.service';

type AnalyticsState = {
  data: AnalyticsData | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: AnalyticsState = {
  data: null,
  isLoading: false,
  error: null,
};

export const AnalyticsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, analyticsService = inject(AnalyticsService)) => ({
    async load() {
      patchState(store, { isLoading: true, error: null });
      const result = await analyticsService.getAnalytics();
      result
        .mapRight((data) => patchState(store, { data, isLoading: false }))
        .mapLeft((error) =>
          patchState(store, { isLoading: false, error: error.message })
        );
    },
  }))
);

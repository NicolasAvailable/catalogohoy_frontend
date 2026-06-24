import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { AiUsageLog, AiUsageStats } from './ai-usage.model';
import { AiUsageLogsQuery, AiUsageService } from './ai-usage.service';

type AiUsageState = {
  stats: AiUsageStats | null;
  logs: AiUsageLog[];
  isLoading: boolean;
  error: string | null;
};

const initialState: AiUsageState = {
  stats: null,
  logs: [],
  isLoading: false,
  error: null,
};

export const AiUsageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, service = inject(AiUsageService)) => ({
    async load(query: AiUsageLogsQuery = {}): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      const [stats, logs] = await Promise.all([
        service.stats(),
        service.listLogs(query),
      ]);

      let error: string | null = null;
      if (stats.isRight()) patchState(store, { stats: stats.value });
      else error = stats.value.message;
      if (logs.isRight()) patchState(store, { logs: logs.value });
      else error = error ?? logs.value.message;

      patchState(store, { isLoading: false, error });
    },
  }))
);

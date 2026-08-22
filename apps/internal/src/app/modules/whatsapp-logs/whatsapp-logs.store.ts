import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  WhatsappLog,
  WhatsappLogStatus,
  WhatsappMonthlyRow,
  WhatsappStats,
} from './whatsapp-logs.model';
import {
  WhatsappLogsQuery,
  WhatsappLogsService,
} from './whatsapp-logs.service';

type WhatsappLogsState = {
  logs: WhatsappLog[];
  stats: WhatsappStats | null;
  monthly: WhatsappMonthlyRow[];
  isLoading: boolean;
  error: string | null;
};

const initialState: WhatsappLogsState = {
  logs: [],
  stats: null,
  monthly: [],
  isLoading: false,
  error: null,
};

export const WhatsappLogsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    counts: computed(() => {
      const logs = store.logs();
      const by = (status: WhatsappLogStatus) =>
        logs.filter((l) => l.status === status).length;
      return {
        total: logs.length,
        sent: by('sent'),
        failed: by('failed'),
        skipped: by('skipped'),
      };
    }),
  })),
  withMethods((store, service = inject(WhatsappLogsService)) => ({
    async load(query: WhatsappLogsQuery = {}): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      const [logsResult, statsResult, monthlyResult] = await Promise.all([
        service.list(query),
        service.stats(),
        service.monthly(3),
      ]);
      logsResult.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (logs) => patchState(store, { logs, isLoading: false })
      );
      // El costo es secundario: si Meta falla, el panel de logs sigue vivo y
      // la card muestra el motivo (stats.metaError o null).
      statsResult.fold(
        () => patchState(store, { stats: null }),
        (stats) => patchState(store, { stats })
      );
      monthlyResult.fold(
        () => patchState(store, { monthly: [] }),
        (monthly) => patchState(store, { monthly })
      );
    },
  }))
);

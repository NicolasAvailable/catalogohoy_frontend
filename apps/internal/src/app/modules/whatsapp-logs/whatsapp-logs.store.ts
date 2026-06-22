import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { WhatsappLog, WhatsappLogStatus } from './whatsapp-logs.model';
import {
  WhatsappLogsQuery,
  WhatsappLogsService,
} from './whatsapp-logs.service';

type WhatsappLogsState = {
  logs: WhatsappLog[];
  isLoading: boolean;
  error: string | null;
};

const initialState: WhatsappLogsState = {
  logs: [],
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
      const result = await service.list(query);
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (logs) => patchState(store, { logs, isLoading: false })
      );
    },
  }))
);

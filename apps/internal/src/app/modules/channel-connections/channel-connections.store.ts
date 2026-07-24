import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ChannelConnection, ChannelType } from './channel-connections.model';
import { ChannelConnectionsService } from './channel-connections.service';

type ChannelConnectionsState = {
  connections: ChannelConnection[];
  isLoading: boolean;
  error: string | null;
};

const initialState: ChannelConnectionsState = {
  connections: [],
  isLoading: false,
  error: null,
};

export const ChannelConnectionsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    counts: computed(() => {
      const connections = store.connections();
      const by = (channel: ChannelType) =>
        connections.filter((c) => c.channel === channel).length;
      // Catálogos distintos con al menos un canal conectado.
      const tenants = new Set(
        connections.map((c) => c.tenantId).filter((id) => id != null)
      ).size;
      return {
        total: connections.length,
        whatsapp: by('whatsapp'),
        instagram: by('instagram'),
        tiktok: by('tiktok'),
        tenants,
      };
    }),
  })),
  withMethods((store, service = inject(ChannelConnectionsService)) => ({
    async load(): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      const result = await service.list();
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (connections) => patchState(store, { connections, isLoading: false })
      );
    },
  }))
);

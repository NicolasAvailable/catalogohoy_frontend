import { inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { Order } from '@catalogohoy/order';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Client, ClientList, emptyClientList } from '../domain/client.model';
import { ClientService } from './client.service';

type ClientState = {
  clientList: ClientList;
  selectedClient: Client | null;
  clientOrders: Order[];
  isLoading: boolean;
  isLoadingOrders: boolean;
};

const initialState: ClientState = {
  clientList: emptyClientList(),
  selectedClient: null,
  clientOrders: [],
  isLoading: false,
  isLoadingOrders: false,
};

export const ClientStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      clientService = inject(ClientService),
      tenantStore = inject(TenantStore)
    ) => ({
      async loadClients() {
        patchState(store, { isLoading: true });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isLoading: false });
          return;
        }

        const result = await clientService.getCustomersByTenant(tenantId);

        result.fold(
          () => patchState(store, { isLoading: false }),
          (clientList) => patchState(store, { clientList, isLoading: false })
        );
      },

      async loadClientByPhone(phone: string) {
        patchState(store, { isLoadingOrders: true, selectedClient: null, clientOrders: [] });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isLoadingOrders: false });
          return;
        }

        // Find client from list or load fresh
        let client = store.clientList().items.find((c) => c.phone === phone) ?? null;

        if (!client) {
          const result = await clientService.getCustomersByTenant(tenantId);
          result.mapRight((list) => {
            patchState(store, { clientList: list });
            client = list.items.find((c) => c.phone === phone) ?? null;
          });
        }

        patchState(store, { selectedClient: client });

        // Load orders for this phone
        const ordersResult = await clientService.getOrdersByPhone(tenantId, phone);

        ordersResult.fold(
          () => patchState(store, { isLoadingOrders: false }),
          (orders) => patchState(store, { clientOrders: orders, isLoadingOrders: false })
        );
      },

      reset() {
        patchState(store, initialState);
      },
    })
  )
);

import { inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { Order } from '@catalogohoy/order';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  Client,
  ClientInput,
  ClientList,
  ClientTag,
  emptyClientList,
} from '../domain/client.model';
import { ClientService } from './client.service';

type ClientState = {
  clientList: ClientList;
  tags: ClientTag[];
  selectedClient: Client | null;
  clientOrders: Order[];
  isLoading: boolean;
  isLoadingOrders: boolean;
  isSaving: boolean;
};

const initialState: ClientState = {
  clientList: emptyClientList(),
  tags: [],
  selectedClient: null,
  clientOrders: [],
  isLoading: false,
  isLoadingOrders: false,
  isSaving: false,
};

export const ClientStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      clientService = inject(ClientService),
      tenantStore = inject(TenantStore)
    ) => {
      const tenantId = () => tenantStore.getTenantIdAsync();

      const reloadClients = async (tid: number) => {
        const result = await clientService.getCustomersByTenant(tid);
        result.mapRight((clientList) => patchState(store, { clientList }));
      };

      return {
        async loadClients() {
          patchState(store, { isLoading: true });
          const tid = await tenantId();
          if (!tid) {
            patchState(store, { isLoading: false });
            return;
          }
          await reloadClients(tid);
          patchState(store, { isLoading: false });
        },

        async loadTags() {
          const tid = await tenantId();
          if (!tid) return;
          const result = await clientService.listTags(tid);
          result.mapRight((tags) => patchState(store, { tags }));
        },

        async loadClientByPhone(phone: string) {
          patchState(store, {
            isLoadingOrders: true,
            selectedClient: null,
            clientOrders: [],
          });

          const tid = await tenantId();
          if (!tid) {
            patchState(store, { isLoadingOrders: false });
            return;
          }

          let client =
            store.clientList().items.find((c) => c.phone === phone) ?? null;

          if (!client) {
            const result = await clientService.getCustomersByTenant(tid);
            result.mapRight((list) => {
              patchState(store, { clientList: list });
              client = list.items.find((c) => c.phone === phone) ?? null;
            });
          }

          patchState(store, { selectedClient: client });

          const ordersResult = await clientService.getOrdersByPhone(tid, phone);
          ordersResult.fold(
            () => patchState(store, { isLoadingOrders: false }),
            (orders) =>
              patchState(store, {
                clientOrders: orders,
                isLoadingOrders: false,
              })
          );
        },

        // ----------------------------------------------------- customers ---

        async addClient(input: ClientInput): Promise<boolean> {
          const tid = await tenantId();
          if (!tid) return false;
          patchState(store, { isSaving: true });
          const result = await clientService.createCustomer(tid, input);
          if (result.isRight()) await reloadClients(tid);
          patchState(store, { isSaving: false });
          return result.isRight();
        },

        async editClient(id: number, input: ClientInput): Promise<boolean> {
          const tid = await tenantId();
          if (!tid) return false;
          patchState(store, { isSaving: true });
          const result = await clientService.updateCustomer(id, tid, input);
          if (result.isRight()) await reloadClients(tid);
          patchState(store, { isSaving: false });
          return result.isRight();
        },

        async removeClients(ids: number[]): Promise<boolean> {
          const tid = await tenantId();
          if (!tid) return false;
          patchState(store, { isSaving: true });
          const result = await clientService.deleteCustomers(ids);
          if (result.isRight()) await reloadClients(tid);
          patchState(store, { isSaving: false });
          return result.isRight();
        },

        // ---------------------------------------------------------- tags ---

        async addTag(name: string, color: string): Promise<ClientTag | null> {
          const tid = await tenantId();
          if (!tid) return null;
          const result = await clientService.createTag(tid, name, color);
          if (result.isRight()) {
            patchState(store, {
              tags: [...store.tags(), result.value].sort((a, b) =>
                a.name.localeCompare(b.name)
              ),
            });
            return result.value;
          }
          return null;
        },

        async editTag(id: number, name: string, color: string): Promise<boolean> {
          const result = await clientService.updateTag(id, name, color);
          if (result.isRight()) {
            const tid = await tenantId();
            patchState(store, {
              tags: store
                .tags()
                .map((t) => (t.id === id ? { ...t, name, color } : t)),
            });
            if (tid) await reloadClients(tid);
          }
          return result.isRight();
        },

        async removeTag(id: number): Promise<boolean> {
          const result = await clientService.deleteTag(id);
          if (result.isRight()) {
            const tid = await tenantId();
            patchState(store, { tags: store.tags().filter((t) => t.id !== id) });
            if (tid) await reloadClients(tid);
          }
          return result.isRight();
        },

        async unlinkTag(customerId: number, tagId: number): Promise<boolean> {
          const tid = await tenantId();
          if (!tid) return false;
          const result = await clientService.unassignTag(customerId, tagId);
          if (result.isRight()) await reloadClients(tid);
          return result.isRight();
        },

        async assignTag(tagId: number, customerIds: number[]): Promise<boolean> {
          const tid = await tenantId();
          if (!tid) return false;
          patchState(store, { isSaving: true });
          const result = await clientService.assignTagToCustomers(
            tagId,
            customerIds
          );
          if (result.isRight()) await reloadClients(tid);
          patchState(store, { isSaving: false });
          return result.isRight();
        },

        reset() {
          patchState(store, initialState);
        },
      };
    }
  )
);

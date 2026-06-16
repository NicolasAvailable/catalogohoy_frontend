import { inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { E } from '@shared/domain';
import { Order, OrderItem, OrderList, OrderStatus } from '../domain/order';
import { OrderService } from './order.service';

type OrderState = {
  orderList: OrderList;
  /** Total rows that match the current filter (server-side count). */
  totalCount: number;
  /** Total rows for the tenant with NO filters — used for the footer label. */
  grandTotalCount: number;
  /** Pending (newly arrived) orders — drives the real-time sidebar badge.
   *  Kept independent of `orderList` because the badge must stay accurate
   *  app-wide, even on pages where the order list isn't loaded. */
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
};

const initialState: OrderState = {
  orderList: OrderList.empty(),
  totalCount: 0,
  grandTotalCount: 0,
  pendingCount: 0,
  isLoading: false,
  error: null,
};

export const OrderStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      orderService = inject(OrderService),
      tenantStore = inject(TenantStore)
    ) => ({
      async loadOrders(options?: {
        date?: Date;
        search?: string;
        status?: OrderStatus | 'all';
        page?: number;
        pageSize?: number;
        orderBy?: 'date_desc' | 'date_asc' | 'total_desc' | 'total_asc';
      }) {
        patchState(store, { isLoading: true, error: null });

        try {
          const tenantId = await tenantStore.getTenantIdAsync();

          if (!tenantId) {
            patchState(store, { isLoading: false });
            return;
          }

          const result = await orderService.getOrdersByTenant(
            tenantId,
            options
          );

          result.fold(
            (error) => {
              patchState(store, { isLoading: false, error: error.message });
            },
            ({ orders, totalCount }) =>
              patchState(store, {
                orderList: new OrderList(orders),
                totalCount,
                isLoading: false,
              })
          );
        } catch {
          patchState(store, { isLoading: false, error: 'Error inesperado' });
        }
      },

      /** Grand total (unfiltered). Call once on init; refresh after
       *  create/delete since those are the only ops that change it. */
      async loadGrandTotalCount() {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;
        const result = await orderService.countOrdersByTenant(tenantId);
        result.mapRight((grandTotalCount) =>
          patchState(store, { grandTotalCount })
        );
      },

      /** Refresh the pending-order count for the sidebar badge. Cheap
       *  count-only query; called on init and on every realtime order change. */
      async loadPendingCount() {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;
        const result = await orderService.countPendingByTenant(tenantId);
        result.mapRight((pendingCount) =>
          patchState(store, { pendingCount })
        );
      },

      async getOrderById(id: number): Promise<Order | null> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return null;

        const result = await orderService.getOrderById(id, tenantId);
        return result.fold(
          () => null,
          (order) => order
        );
      },

      async createOrder(input: {
        name: string;
        phone?: string;
        comments?: string;
        status: OrderStatus;
        products: OrderItem[];
        totalUsd: number;
        totalBs: number;
        deliveryDate?: string;
        paymentMethod?: string;
      }): Promise<E.Either<string, Order>> {
        patchState(store, { isLoading: true, error: null });

        try {
          const tenantId = await tenantStore.getTenantIdAsync();

          if (!tenantId) {
            patchState(store, { isLoading: false });
            return E.left('No se pudo obtener el tenant');
          }

          const result = await orderService.createOrder({
            ...input,
            tenantId,
          });

          patchState(store, { isLoading: false });

          return result.fold(
            (error) => E.left(error.message),
            (order) => {
              // Actualizar la lista de órdenes
              patchState(store, {
                orderList: new OrderList([order, ...store.orderList().items]),
              });
              return E.right(order);
            }
          );
        } catch {
          patchState(store, { isLoading: false, error: 'Error inesperado' });
          return E.left('Error inesperado');
        }
      },

      async updateOrder(input: {
        id: number;
        name: string;
        phone?: string;
        comments?: string;
        status: OrderStatus;
        products: OrderItem[];
        totalUsd: number;
        totalBs: number;
        deliveryDate?: string;
        paymentMethod?: string;
      }): Promise<E.Either<string, Order>> {
        patchState(store, { isLoading: true, error: null });

        try {
          const tenantId = await tenantStore.getTenantIdAsync();

          if (!tenantId) {
            patchState(store, { isLoading: false });
            return E.left('No se pudo obtener el tenant');
          }

          const result = await orderService.updateOrder({
            ...input,
            tenantId,
          });

          patchState(store, { isLoading: false });

          return result.fold(
            (error) => E.left(error.message),
            (order) => {
              // Actualizar la orden en la lista
              const updatedItems = store
                .orderList()
                .items.map((o) => (o.id === order.id ? order : o));
              patchState(store, {
                orderList: new OrderList(updatedItems),
              });
              return E.right(order);
            }
          );
        } catch {
          patchState(store, { isLoading: false, error: 'Error inesperado' });
          return E.left('Error inesperado');
        }
      },

      async updateOrderStatus(
        id: number,
        oldStatus: OrderStatus,
        newStatus: OrderStatus
      ): Promise<E.Either<string, Order>> {
        try {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return E.left('Tenant no encontrado');

          const result = await orderService.updateOrderStatus(
            id,
            tenantId,
            oldStatus,
            newStatus
          );

          return result.fold(
            (error) => E.left(error.message),
            (order) => {
              const updatedItems = store
                .orderList()
                .items.map((o) => (o.id === order.id ? order : o));
              patchState(store, {
                orderList: new OrderList(updatedItems),
              });
              return E.right(order);
            }
          );
        } catch {
          return E.left('Error inesperado');
        }
      },

      async updateInternalComments(
        id: number,
        comments: string
      ): Promise<E.Either<string, Order>> {
        try {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return E.left('Tenant no encontrado');

          const result = await orderService.updateInternalComments(
            id,
            tenantId,
            comments
          );

          return result.fold(
            (error) => E.left(error.message),
            (order) => {
              const updatedItems = store
                .orderList()
                .items.map((o) => (o.id === order.id ? order : o));
              patchState(store, { orderList: new OrderList(updatedItems) });
              return E.right(order);
            }
          );
        } catch {
          return E.left('Error inesperado');
        }
      },

      async deleteOrder(id: number): Promise<E.Either<string, void>> {
        try {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) {
            return E.left('Tenant no encontrado');
          }

          patchState(store, { isLoading: true, error: null });

          const result = await orderService.deleteOrder(id, tenantId);

          patchState(store, { isLoading: false });

          return result.fold(
            (error) => E.left(error.message),
            () => {
              // Remover la orden de la lista
              const updatedItems = store
                .orderList()
                .items.filter((o) => o.id !== id);
              patchState(store, {
                orderList: new OrderList(updatedItems),
              });
              return E.right(undefined);
            }
          );
        } catch {
          patchState(store, { isLoading: false, error: 'Error inesperado' });
          return E.left('Error inesperado');
        }
      },

      addOrder(order: Order) {
        const exists = store.orderList().items.some((o) => o.id === order.id);
        if (exists) return;
        patchState(store, {
          orderList: new OrderList([order, ...store.orderList().items]),
        });
      },

      replaceOrder(order: Order) {
        const items = store.orderList().items.map((o) => (o.id === order.id ? order : o));
        patchState(store, { orderList: new OrderList(items) });
      },

      removeOrder(id: number) {
        const items = store.orderList().items.filter((o) => o.id !== id);
        patchState(store, { orderList: new OrderList(items) });
      },
    })
  )
);

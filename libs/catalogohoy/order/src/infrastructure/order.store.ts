import { inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { E } from '@shared/domain';
import { Order, OrderItem, OrderList, OrderStatus } from '../domain/order';
import { OrderService } from './order.service';

type OrderState = {
  orderList: OrderList;
  isLoading: boolean;
  error: string | null;
};

const initialState: OrderState = {
  orderList: OrderList.empty(),
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
      async loadOrders(options?: { date?: Date; search?: string }) {
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
            (orders) =>
              patchState(store, {
                orderList: new OrderList(orders),
                isLoading: false,
              })
          );
        } catch {
          patchState(store, { isLoading: false, error: 'Error inesperado' });
        }
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
    })
  )
);

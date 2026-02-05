import { inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { OrderList } from '../domain/order';
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
      async loadOrders() {
        patchState(store, { isLoading: true, error: null });

        try {
          const tenantId = await tenantStore.getTenantIdAsync();
          console.log('tenantId', tenantId);

          if (!tenantId) {
            patchState(store, { isLoading: false });
            return;
          }

          const result = await orderService.getOrdersByTenant(tenantId);

          result.fold(
            (error) => {
              patchState(store, { isLoading: false, error: error.message });
            },
            (orders) => {
              console.log(
                '✅ [OrderStore] Órdenes cargadas exitosamente. Cantidad:',
                orders.length
              );
              patchState(store, {
                orderList: new OrderList(orders),
                isLoading: false,
              });
            }
          );
        } catch (err) {
          console.error('❌ [OrderStore] Error inesperado:', err);
          patchState(store, { isLoading: false, error: 'Error inesperado' });
        }
      },
    })
  )
);

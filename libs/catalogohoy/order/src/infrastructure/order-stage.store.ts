import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { E } from '@shared/domain';
import { buildStatusOptions, OrderStage } from '../domain';
import { OrderStageService, SaveOrderStageInput } from './order-stage.service';

type OrderStageState = {
  stages: OrderStage[];
  /** Tenant de los estados cargados (evita recargar en cada pantalla). */
  loadedTenantId: number | null;
  isLoading: boolean;
};

const initialState: OrderStageState = {
  stages: [],
  loadedTenantId: null,
  isLoading: false,
};

/** Estados de orden propios de la tienda + las opciones de los selectores
 *  (base + propios) que usan la lista, el detalle y el editor de órdenes. */
export const OrderStageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    statusOptions: computed(() => buildStatusOptions(store.stages())),
  })),
  withMethods(
    (
      store,
      service = inject(OrderStageService),
      tenantStore = inject(TenantStore)
    ) => ({
      async load(force = false): Promise<void> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;
        if (!force && store.loadedTenantId() === tenantId) return;
        patchState(store, { isLoading: true });
        const result = await service.list(tenantId);
        result.fold(
          () => patchState(store, { isLoading: false }),
          (stages) =>
            patchState(store, { stages, loadedTenantId: tenantId, isLoading: false })
        );
      },

      async create(input: SaveOrderStageInput): Promise<E.Either<string, OrderStage>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('Tenant no encontrado');
        const position = store.stages().length;
        const result = await service.create(tenantId, input, position);
        return result.fold(
          (error) => E.left(error.message),
          (stage) => {
            patchState(store, { stages: [...store.stages(), stage] });
            return E.right(stage);
          }
        );
      },

      async update(
        id: string,
        input: SaveOrderStageInput
      ): Promise<E.Either<string, OrderStage>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('Tenant no encontrado');
        const result = await service.update(tenantId, id, input);
        return result.fold(
          (error) => E.left(error.message),
          (stage) => {
            patchState(store, {
              stages: store.stages().map((s) => (s.id === id ? stage : s)),
            });
            return E.right(stage);
          }
        );
      },

      async move(id: string, direction: -1 | 1): Promise<E.Either<string, void>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('Tenant no encontrado');
        const list = [...store.stages()].sort((a, b) => a.position - b.position);
        const from = list.findIndex((s) => s.id === id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= list.length) return E.right(undefined);
        [list[from], list[to]] = [list[to], list[from]];
        const reordered = list.map((s, position) => ({ ...s, position }));
        patchState(store, { stages: reordered });
        const result = await service.reorder(
          tenantId,
          reordered.map((s) => s.id)
        );
        return result.mapLeft((error) => error.message);
      },

      async remove(id: string): Promise<E.Either<string, void>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('Tenant no encontrado');
        const result = await service.remove(tenantId, id);
        return result.fold(
          (error) => E.left(error.message),
          () => {
            patchState(store, {
              stages: store.stages().filter((s) => s.id !== id),
            });
            return E.right(undefined);
          }
        );
      },

      async countOrders(id: string): Promise<number> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return 0;
        return service.countOrders(tenantId, id);
      },
    })
  )
);

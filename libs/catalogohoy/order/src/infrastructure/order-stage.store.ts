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
import {
  buildStatusDefs,
  NEW_STAGE_OPTION,
  OrderStage,
  OrderStatusDef,
  OrderStatusKey,
  OrderStatusOption,
  toOption,
} from '../domain';
import { OrderStageService } from './order-stage.service';

type OrderStageState = {
  rows: OrderStage[];
  /** Tenant de los estados cargados (evita recargar en cada pantalla). */
  loadedTenantId: number | null;
  isLoading: boolean;
};

const initialState: OrderStageState = {
  rows: [],
  loadedTenantId: null,
  isLoading: false,
};

/** Estados de orden de la tienda (base personalizados + propios) y las
 *  opciones que usan la lista, el tablero, el detalle y el editor. */
export const OrderStageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const defs = computed(() => buildStatusDefs(store.rows()));
    const visibleDefs = computed(() => defs().filter((d) => !d.hidden));
    const visibleOptions = computed(() => visibleDefs().map(toOption));
    return {
      /** Todos los estados (incluye ocultos), en orden. */
      defs,
      /** Los que se muestran como columnas, filtros y opciones. */
      visibleDefs,
      visibleOptions,
      /** Opciones del selector + "+ Crear estado" al final. */
      selectOptions: computed(() => [...visibleOptions(), NEW_STAGE_OPTION]),
    };
  }),
  withMethods(
    (
      store,
      service = inject(OrderStageService),
      tenantStore = inject(TenantStore)
    ) => {
      // Si una orden está en un estado oculto, su selector lo agrega para que
      // se vea bien. Cacheado por clave para no crear arrays en cada render.
      let cache = new Map<string, OrderStatusOption[]>();
      let cacheBase: OrderStatusOption[] | null = null;

      return {
        async load(force = false): Promise<void> {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return;
          if (!force && store.loadedTenantId() === tenantId) return;
          patchState(store, { isLoading: true });
          const result = await service.list(tenantId);
          result.fold(
            () => patchState(store, { isLoading: false }),
            (rows) =>
              patchState(store, { rows, loadedTenantId: tenantId, isLoading: false })
          );
        },

        def(key: OrderStatusKey): OrderStatusDef | undefined {
          return store.defs().find((d) => d.key === key);
        },

        optionsFor(key: OrderStatusKey): OrderStatusOption[] {
          const base = store.selectOptions();
          if (base !== cacheBase) {
            cache = new Map();
            cacheBase = base;
          }
          const def = store.defs().find((d) => d.key === key);
          if (!def?.hidden) return base;
          let opts = cache.get(key);
          if (!opts) {
            opts = [...base.slice(0, -1), toOption(def), base[base.length - 1]];
            cache.set(key, opts);
          }
          return opts;
        },

        async saveAll(
          defs: OrderStatusDef[],
          deletedIds: string[]
        ): Promise<E.Either<string, void>> {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return E.left('Tenant no encontrado');
          const result = await service.saveAll(tenantId, defs, deletedIds);
          // Recargar siempre: aunque falle a mitad, la UI queda como la BD.
          const rows = await service.list(tenantId);
          rows.mapRight((r) => patchState(store, { rows: r, loadedTenantId: tenantId }));
          return result.mapLeft((error) => error.message);
        },

        async countOrders(stageId: string): Promise<number> {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return 0;
          return service.countOrders(tenantId, stageId);
        },
      };
    }
  )
);

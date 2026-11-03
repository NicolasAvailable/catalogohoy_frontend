import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { E } from '@shared/domain';
import {
  buildExpenseStatusDefs,
  ExpenseStage,
  ExpenseStatusDef,
  ExpenseStatusKey,
} from '../domain';
import { ExpenseStageService } from './expense-stage.service';

type ExpenseStageState = {
  rows: ExpenseStage[];
  loadedTenantId: number | null;
  isLoading: boolean;
};

const initialState: ExpenseStageState = { rows: [], loadedTenantId: null, isLoading: false };

/** Estados de Gastos y facturas de la tienda (base personalizados + propios). */
export const ExpenseStageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const defs = computed(() => buildExpenseStatusDefs(store.rows()));
    return {
      /** Todos (incluye ocultos), en orden. */
      defs,
      /** Los que se muestran como filtros y opciones. */
      visibleDefs: computed(() => defs().filter((d) => !d.hidden)),
    };
  }),
  withMethods(
    (store, service = inject(ExpenseStageService), tenantStore = inject(TenantStore)) => ({
      async load(force = false): Promise<void> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;
        if (!force && store.loadedTenantId() === tenantId) return;
        patchState(store, { isLoading: true });
        const result = await service.list(tenantId);
        result.fold(
          // Si falla, se sigue con los estados base.
          () => patchState(store, { loadedTenantId: tenantId, isLoading: false }),
          (rows) => patchState(store, { rows, loadedTenantId: tenantId, isLoading: false })
        );
      },

      def(key: ExpenseStatusKey): ExpenseStatusDef | undefined {
        return store.defs().find((d) => d.key === key);
      },

      async saveAll(defs: ExpenseStatusDef[], deletedIds: string[]): Promise<E.Either<string, void>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('Tienda no encontrada');
        const result = await service.saveAll(tenantId, defs, deletedIds);
        // Recargar siempre: aunque falle a mitad, la UI queda como la BD.
        const rows = await service.list(tenantId);
        rows.mapRight((r) => patchState(store, { rows: r, loadedTenantId: tenantId }));
        return result.mapLeft((error) => error.message);
      },

      async countExpenses(stageId: string): Promise<number> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return 0;
        return service.countExpenses(tenantId, stageId);
      },
    })
  )
);

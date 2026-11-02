import { computed, inject } from '@angular/core';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  currentMonth,
  Expense,
  ExpenseInput,
  monthRange,
  totalsByCategory,
  totalsByCurrency,
} from '../domain';
import { ExpenseService } from './expense.service';

type ExpenseState = {
  /** Mes mostrado, 'YYYY-MM'. */
  month: string;
  expenses: Expense[];
  isLoading: boolean;
  isSaving: boolean;
};

const initialState: ExpenseState = {
  month: currentMonth(),
  expenses: [],
  isLoading: false,
  isSaving: false,
};

/** Gastos y facturas de proveedores del mes seleccionado. */
export const ExpenseStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store, currency = inject(TenantCurrencyStore)) => {
    const mainCurrency = computed(() => currency.displayCode() || 'USD');
    const totals = computed(() => totalsByCurrency(store.expenses(), mainCurrency()));
    return {
      mainCurrency,
      totals,
      byCategory: computed(() => totalsByCategory(store.expenses(), mainCurrency())),
      pendingCount: computed(() => store.expenses().filter((e) => e.status === 'pending').length),
    };
  }),
  withMethods(
    (store, service = inject(ExpenseService), tenantStore = inject(TenantStore)) => {
      const sortExpenses = (list: Expense[]) =>
        [...list].sort(
          (a, b) =>
            b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt)
        );
      const inMonth = (e: Expense) => {
        const { from, to } = monthRange(store.month());
        return e.issueDate >= from && e.issueDate < to;
      };

      return {
        async load(month = store.month()): Promise<void> {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return;
          patchState(store, { month, isLoading: true });
          const { from, to } = monthRange(month);
          const result = await service.list(tenantId, from, to);
          // Si el usuario cambió de mes mientras cargaba, se descarta.
          if (store.month() !== month) return;
          result.fold(
            () => patchState(store, { expenses: [], isLoading: false }),
            (expenses) => patchState(store, { expenses, isLoading: false })
          );
        },

        async save(id: string | null, input: ExpenseInput): Promise<boolean> {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return false;
          patchState(store, { isSaving: true });
          const result = id
            ? await service.update(tenantId, id, input)
            : await service.create(tenantId, input);
          patchState(store, { isSaving: false });
          return result.fold(
            () => false,
            (saved) => {
              const rest = store.expenses().filter((e) => e.id !== saved.id);
              patchState(store, {
                expenses: sortExpenses(inMonth(saved) ? [...rest, saved] : rest),
              });
              return true;
            }
          );
        },

        async setStatus(expense: Expense, status: Expense['status'], paidAt: string | null): Promise<boolean> {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return false;
          const result = await service.update(tenantId, expense.id, { status, paidAt });
          return result.fold(
            () => false,
            (saved) => {
              patchState(store, {
                expenses: store.expenses().map((e) => (e.id === saved.id ? saved : e)),
              });
              return true;
            }
          );
        },

        async remove(id: string): Promise<boolean> {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return false;
          const result = await service.remove(tenantId, id);
          return result.fold(
            () => false,
            () => {
              patchState(store, { expenses: store.expenses().filter((e) => e.id !== id) });
              return true;
            }
          );
        },

        uploadFile: async (file: File) => {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return null;
          const result = await service.uploadFile(tenantId, file);
          return result.fold(
            () => null,
            (url) => url
          );
        },
      };
    }
  )
);

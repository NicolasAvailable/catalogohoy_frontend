import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { E } from '@shared/domain';
import {
  currentMonth,
  monthRangeIso,
  Seller,
  SellerCommissionRow,
  SellerInput,
  SellerOrder,
  sellerErrorMessage,
} from '../domain';
import { SellerService } from './seller.service';

type SellerState = {
  /** Mes del reporte, 'YYYY-MM'. */
  month: string;
  sellers: Seller[];
  report: SellerCommissionRow[];
  isLoading: boolean;
  isSaving: boolean;
};

const initialState: SellerState = {
  month: currentMonth(),
  sellers: [],
  report: [],
  isLoading: false,
  isSaving: false,
};

/** Vendedores de la tienda + reporte de comisiones del mes. */
export const SellerStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totals: computed(() =>
      store.report().reduce(
        (acc, r) => ({
          sales: acc.sales + r.sales,
          commission: acc.commission + r.commission,
          paid: acc.paid + r.commissionPaid,
          pending: acc.pending + r.commissionPending,
          orders: acc.orders + r.completedOrders,
        }),
        { sales: 0, commission: 0, paid: 0, pending: 0, orders: 0 }
      )
    ),
  })),
  withMethods((store, service = inject(SellerService), tenantStore = inject(TenantStore)) => {
    const range = () => monthRangeIso(store.month());

    const loadReport = async (tenantId: number, month: string) => {
      const { from, to } = monthRangeIso(month);
      const result = await service.commissions(tenantId, from, to);
      if (store.month() !== month) return;
      result.mapRight((report) => patchState(store, { report }));
    };

    return {
      async load(month = store.month()): Promise<void> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;
        patchState(store, { month, isLoading: true });
        const [list] = await Promise.all([service.list(tenantId), loadReport(tenantId, month)]);
        list.mapRight((sellers) => patchState(store, { sellers }));
        patchState(store, { isLoading: false });
      },

      async refreshReport(): Promise<void> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (tenantId) await loadReport(tenantId, store.month());
      },

      /** Guarda (crea o edita). Devuelve null si salió bien o el mensaje de error. */
      async save(input: SellerInput, id?: string): Promise<string | null> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return 'No se pudo obtener la tienda.';
        patchState(store, { isSaving: true });
        const result = id ? await service.update(tenantId, id, input) : await service.create(tenantId, input);
        patchState(store, { isSaving: false });
        if (result.isLeft()) return sellerErrorMessage((result.value as Error).message);
        const saved = result.value as Seller;
        patchState(store, {
          sellers: id
            ? store.sellers().map((s) => (s.id === id ? saved : s))
            : [...store.sellers(), saved],
        });
        await loadReport(tenantId, store.month());
        return null;
      },

      async remove(id: string): Promise<string | null> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return 'No se pudo obtener la tienda.';
        const result = await service.remove(tenantId, id);
        if (result.isLeft()) return sellerErrorMessage((result.value as Error).message);
        patchState(store, {
          sellers: store.sellers().filter((s) => s.id !== id),
          report: store.report().filter((r) => r.sellerId !== id),
        });
        return null;
      },

      async setPaid(sellerId: string, paid: boolean): Promise<E.Either<string, number>> {
        const { from, to } = range();
        const result = await service.setPaid(sellerId, from, to, paid);
        if (result.isLeft()) return E.left(sellerErrorMessage((result.value as Error).message));
        const tenantId = await tenantStore.getTenantIdAsync();
        if (tenantId) await loadReport(tenantId, store.month());
        return E.right(result.value as number);
      },

      async orders(sellerId: string) {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return [];
        const { from, to } = range();
        const result = await service.orders(tenantId, sellerId, from, to);
        return result.isRight() ? (result.value as SellerOrder[]) : [];
      },
    };
  })
);

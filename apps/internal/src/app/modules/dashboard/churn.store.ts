import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ChurnPoint, ChurnService } from './churn.service';

type ChurnState = {
  points: ChurnPoint[];
  isLoading: boolean;
  error: string | null;
};

const initialState: ChurnState = {
  points: [],
  isLoading: false,
  error: null,
};

const last = (points: ChurnPoint[]): ChurnPoint | null =>
  points.length ? points[points.length - 1] : null;

export const ChurnStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /** Churn del mes en curso (clientes perdidos hasta hoy). */
    currentChurned: computed(() => last(store.points())?.churned ?? 0),
    currentChurnRate: computed(() => last(store.points())?.churnRate ?? 0),
    currentActiveStart: computed(() => last(store.points())?.activeStart ?? 0),
    /** Churn total acumulado en la ventana cargada. */
    totalChurned: computed(() =>
      store.points().reduce((sum, p) => sum + p.churned, 0)
    ),
    /** Promedio de churn rate de los meses COMPLETOS (excluye el mes en curso
     *  y meses sin base). Es la referencia estable de la salud del negocio. */
    avgChurnRate: computed(() => {
      const complete = store
        .points()
        .slice(0, -1)
        .filter((p) => p.activeStart > 0);
      if (!complete.length) return 0;
      return (
        complete.reduce((sum, p) => sum + p.churnRate, 0) / complete.length
      );
    }),
    /** Variación de la tasa de churn vs el mes anterior (en puntos %). */
    churnRateDelta: computed(() => {
      const points = store.points();
      if (points.length < 2) return 0;
      return (
        points[points.length - 1].churnRate -
        points[points.length - 2].churnRate
      );
    }),
  })),
  withMethods((store, service = inject(ChurnService)) => ({
    async load(months = 12) {
      patchState(store, { isLoading: true, error: null });
      const result = await service.getMetrics(months);
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (points) => patchState(store, { points, isLoading: false })
      );
    },
  }))
);

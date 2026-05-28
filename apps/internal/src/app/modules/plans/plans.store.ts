import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Plan, PlanUpdate } from './plans.model';
import { PlansService } from './plans.service';

type PlansState = {
  plans: Plan[];
  isLoading: boolean;
  savingId: string | null;
  error: string | null;
};

const initialState: PlansState = {
  plans: [],
  isLoading: false,
  savingId: null,
  error: null,
};

export const PlansStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, service = inject(PlansService)) => ({
    async load() {
      patchState(store, { isLoading: true, error: null });
      const result = await service.list();
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (plans) => patchState(store, { plans, isLoading: false })
      );
    },

    async save(id: string, patch: PlanUpdate) {
      patchState(store, { savingId: id, error: null });
      const result = await service.update(id, patch);
      patchState(store, { savingId: null });
      if (result.isLeft()) {
        patchState(store, { error: result.value.message });
        return;
      }
      const refreshed = await service.list();
      refreshed.mapRight((plans) => patchState(store, { plans }));
    },
  }))
);

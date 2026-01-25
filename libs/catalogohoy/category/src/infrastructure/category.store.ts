import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { CategoryList } from '../domain';
import { CategoryService } from './category.service';

type CategoryState = {
  categoryList: CategoryList;
  isLoading: boolean;
};

const initialState: CategoryState = {
  categoryList: CategoryList.empty(),
  isLoading: true,
};

export const CategoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, categoryService = inject(CategoryService)) => ({
    async categoryList$(page = 1, pageSize = 10) {
      patchState(store, () => ({ isLoading: true }));

      try {
        const result = await categoryService.getAll(page, pageSize);
        result.mapRight((categoryList) =>
          patchState(store, () => ({ categoryList, isLoading: false }))
        );
      } catch {
        patchState(store, () => ({ isLoading: false }));
      }
    },
    set(categoryList: CategoryList) {
      patchState(store, () => ({ categoryList }));
    },
    reset() {
      patchState(store, () => initialState);
    },
  }))
);

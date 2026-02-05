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
    async categoryList$(page = 1, pageSize = 100) {
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
    async save(input: {
      id?: string;
      name: string;
      description?: string;
      isVisible: boolean;
    }) {
      patchState(store, () => ({ isLoading: true }));

      const result = input.id
        ? await categoryService.update(input as any)
        : await categoryService.create(input as any);

      return result.mapRight(() => {
        this.categoryList$();
        return;
      });
    },
    set(categoryList: CategoryList) {
      patchState(store, () => ({ categoryList, isLoading: false }));
    },
    reset() {
      patchState(store, () => ({ ...initialState, isLoading: false }));
    },
  }))
);

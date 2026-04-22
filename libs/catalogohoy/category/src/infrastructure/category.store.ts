import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Category, CategoryList } from '../domain';
import { CategoryService } from './category.service';

type CategoryState = {
  categoryList: CategoryList;
  /** Total count from the server, independent of the current page size. */
  total: number;
  /** Current page (1-based) so that mutations can re-fetch the same page. */
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
};

const initialState: CategoryState = {
  categoryList: CategoryList.empty(),
  total: 0,
  currentPage: 1,
  pageSize: 10,
  isLoading: true,
};

export const CategoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, categoryService = inject(CategoryService)) => ({
    async categoryList$(page?: number, pageSize?: number) {
      const nextPage = page ?? store.currentPage();
      const nextSize = pageSize ?? store.pageSize();

      patchState(store, () => ({
        isLoading: true,
        currentPage: nextPage,
        pageSize: nextSize,
      }));

      try {
        const result = await categoryService.getAll(nextPage, nextSize);
        result.mapRight(({ list, total }) =>
          patchState(store, () => ({
            categoryList: list,
            total,
            isLoading: false,
          }))
        );
        result.mapLeft(() => patchState(store, () => ({ isLoading: false })));
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

      if (input.id) {
        const result = await categoryService.update(input as any);
        return result.mapRight(() => {
          // Re-fetch using the current pagination state above so mutations
          // don't accidentally load every category and break the paginator.
          this.categoryList$();
          return undefined as Category | undefined;
        });
      }

      const result = await categoryService.create(input as any);
      return result.mapRight((created) => {
        // Insert the created row into the local list so consumers (e.g. the
        // product form's category multi-select) can pre-select it before the
        // paginated refresh completes.
        const next = CategoryList.from([
          ...store.categoryList().categories,
          created,
        ]);
        patchState(store, () => ({
          categoryList: next,
          total: store.total() + 1,
        }));
        // Re-fetch using the current pagination state above so mutations
        // don't accidentally load every category and break the paginator.
        this.categoryList$();
        return created as Category | undefined;
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

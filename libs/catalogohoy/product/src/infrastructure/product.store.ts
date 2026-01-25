import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { ProductList } from '../domain';
import { ProductService } from './product.service';

type ProductState = {
  productList: ProductList;
  isLoading: boolean;
};

const initialState: ProductState = {
  productList: ProductList.empty(),
  isLoading: true,
};

export const ProductStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, productService = inject(ProductService)) => ({
    async productList$() {
      patchState(store, () => ({ isLoading: true }));

      try {
        const result = await productService.getAll();
        result.mapRight((productList) =>
          patchState(store, () => ({ productList, isLoading: false }))
        );
      } catch (error) {
        patchState(store, () => ({ isLoading: false }));
      }
    },
    set(productList: ProductList) {
      patchState(store, () => ({ productList }));
    },
    reset() {
      patchState(store, () => initialState);
    },
  }))
);

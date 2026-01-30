import { inject } from '@angular/core';
import { Product, ProductList } from '@catalogohoy/product';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { CatalogInfo } from '../domain';
import { EcommerceService } from './ecommerce.service';

type EcommerceState = {
  catalogInfo: CatalogInfo | null;
  productList: ProductList;
  selectedProduct: Product | null;
  categories: { id: string; name: string }[];
  isLoading: boolean;
  searchTerm: string;
  selectedCategoryId: string | null;
  orderBy: 'name' | 'price_asc' | 'price_desc' | null;
};

const initialState: EcommerceState = {
  catalogInfo: null,
  productList: ProductList.empty(),
  selectedProduct: null,
  categories: [],
  isLoading: true,
  searchTerm: '',
  selectedCategoryId: null,
  orderBy: null,
};

export const EcommerceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, ecommerceService = inject(EcommerceService)) => ({
    async loadCatalog(slug: string) {
      patchState(store, () => ({ isLoading: true }));

      try {
        const [catalogResult, productsResult, categoriesResult] =
          await Promise.all([
            ecommerceService.getCatalogInfo(slug),
            ecommerceService.getProducts(slug),
            ecommerceService.getCategories(slug),
          ]);

        catalogResult.mapRight((catalogInfo) =>
          patchState(store, () => ({ catalogInfo }))
        );

        productsResult.mapRight((productList) =>
          patchState(store, () => ({ productList }))
        );

        categoriesResult.mapRight((categories) =>
          patchState(store, () => ({ categories }))
        );

        patchState(store, () => ({ isLoading: false }));
      } catch {
        patchState(store, () => ({ isLoading: false }));
      }
    },

    async loadProducts(slug: string) {
      patchState(store, () => ({ isLoading: true }));

      try {
        const result = await ecommerceService.getProducts(
          slug,
          store.searchTerm(),
          store.selectedCategoryId() ?? undefined,
          store.orderBy() ?? undefined
        );

        result.mapRight((productList) =>
          patchState(store, () => ({ productList, isLoading: false }))
        );
      } catch {
        patchState(store, () => ({ isLoading: false }));
      }
    },

    async loadProduct(id: string) {
      patchState(store, () => ({ isLoading: true }));

      try {
        const result = await ecommerceService.getProductById(id);
        result.mapRight((selectedProduct) =>
          patchState(store, () => ({ selectedProduct, isLoading: false }))
        );
      } catch {
        patchState(store, () => ({ isLoading: false }));
      }
    },

    setSearchTerm(searchTerm: string) {
      patchState(store, () => ({ searchTerm }));
    },

    setSelectedCategory(categoryId: string | null) {
      patchState(store, () => ({ selectedCategoryId: categoryId }));
    },

    setOrderBy(orderBy: 'name' | 'price_asc' | 'price_desc' | null) {
      patchState(store, () => ({ orderBy }));
    },

    clearSelectedProduct() {
      patchState(store, () => ({ selectedProduct: null }));
    },

    reset() {
      patchState(store, () => initialState);
    },
  }))
);

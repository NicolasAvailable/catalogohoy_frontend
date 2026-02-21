import { inject } from '@angular/core';
import { Product, ProductList } from '@catalogohoy/product';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { CatalogInfo } from '../domain';
import { EcommerceService } from './ecommerce.service';

const PAGE_SIZE = 20;

type EcommerceState = {
  catalogInfo: CatalogInfo | null;
  productList: ProductList;
  selectedProduct: Product | null;
  categories: { id: string; name: string }[];
  isLoading: boolean;
  isLoadingMore: boolean;
  searchTerm: string;
  selectedCategoryId: string | null;
  orderBy: 'name' | 'price_asc' | 'price_desc' | null;
  currentPage: number;
  totalCount: number;
  hasMore: boolean;
};

const initialState: EcommerceState = {
  catalogInfo: null,
  productList: ProductList.empty(),
  selectedProduct: null,
  categories: [],
  isLoading: true,
  isLoadingMore: false,
  searchTerm: '',
  selectedCategoryId: null,
  orderBy: null,
  currentPage: 1,
  totalCount: 0,
  hasMore: true,
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
            ecommerceService.getProducts(slug, undefined, undefined, undefined, 1, PAGE_SIZE),
            ecommerceService.getCategories(slug),
          ]);

        catalogResult.mapRight((catalogInfo) =>
          patchState(store, () => ({ catalogInfo }))
        );

        productsResult.mapRight(({ productList, totalCount }) =>
          patchState(store, () => ({
            productList,
            totalCount,
            currentPage: 1,
            hasMore: productList.length < totalCount,
          }))
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
          store.orderBy() ?? undefined,
          1,
          PAGE_SIZE
        );

        result.mapRight(({ productList, totalCount }) =>
          patchState(store, () => ({
            productList,
            totalCount,
            currentPage: 1,
            hasMore: productList.length < totalCount,
            isLoading: false,
          }))
        );
      } catch {
        patchState(store, () => ({ isLoading: false }));
      }
    },

    async loadMoreProducts(slug: string) {
      if (store.isLoadingMore() || !store.hasMore()) return;

      patchState(store, () => ({ isLoadingMore: true }));

      const nextPage = store.currentPage() + 1;

      try {
        const result = await ecommerceService.getProducts(
          slug,
          store.searchTerm(),
          store.selectedCategoryId() ?? undefined,
          store.orderBy() ?? undefined,
          nextPage,
          PAGE_SIZE
        );

        result.mapRight(({ productList: newProducts, totalCount }) => {
          const currentProducts = store.productList().products;
          const merged = ProductList.from([...currentProducts, ...newProducts.products]);
          patchState(store, () => ({
            productList: merged,
            totalCount,
            currentPage: nextPage,
            hasMore: merged.length < totalCount,
            isLoadingMore: false,
          }));
        });
      } catch {
        patchState(store, () => ({ isLoadingMore: false }));
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

    async createOrder(order: {
      name: string;
      phone: string;
      comments: string;
      items: any[];
      total: number;
    }) {
      const catalogInfo = store.catalogInfo();
      if (!catalogInfo) return;

      patchState(store, () => ({ isLoading: true }));

      const result = await ecommerceService.createOrder({
        tenant_id: Number(catalogInfo.id),
        name: order.name,
        products: order.items,
        total_usd: order.total,
        phone: order.phone,
        comments: order.comments,
      });

      patchState(store, () => ({ isLoading: false }));
      return result;
    },

    reset() {
      patchState(store, () => initialState);
    },
  }))
);

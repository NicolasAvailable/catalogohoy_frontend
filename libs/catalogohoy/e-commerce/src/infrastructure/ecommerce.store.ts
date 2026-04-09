import { computed, inject } from '@angular/core';
import { Product, ProductList } from '@catalogohoy/product';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
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
  previewOverrides: Partial<CatalogInfo> | null;
  isPreviewMode: boolean;
  exchangeRate: number;
  heroLogoVisible: boolean;
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
  previewOverrides: null,
  isPreviewMode: false,
  exchangeRate: 0,
  heroLogoVisible: true,
};

export const EcommerceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    effectiveCatalogInfo: computed(() => {
      const base = store.catalogInfo();
      const overrides = store.previewOverrides();
      if (!base) return null;
      if (!overrides || !store.isPreviewMode()) return base;
      return { ...base, ...overrides };
    }),
    currencySymbol: computed(() => {
      const overrides = store.previewOverrides();
      if (store.isPreviewMode() && overrides?.currencySymbol) {
        return overrides.currencySymbol;
      }
      return store.catalogInfo()?.currencySymbol ?? '$';
    }),
  })),
  withMethods((store, ecommerceService = inject(EcommerceService)) => ({
    async loadCatalog(slug: string) {
      patchState(store, () => ({ isLoading: true }));

      try {
        // 1. Single RPC: catalog info + categories + rate + plan status
        const catalogResult = await ecommerceService.getPublicCatalog(slug);

        if (catalogResult.isLeft()) {
          patchState(store, () => ({ isLoading: false }));
          return catalogResult;
        }

        const { catalogInfo, categories, exchangeRate, planExpired, isFreePlan } =
          catalogResult.value;

        patchState(store, () => ({
          catalogInfo,
          categories,
          exchangeRate,
        }));

        // 2. Products query using tenant_id from RPC (no extra tenant lookup)
        const productsResult = await ecommerceService.getProducts(
          slug,
          undefined,
          undefined,
          undefined,
          1,
          PAGE_SIZE,
          String(catalogInfo.id)
        );

        productsResult.mapRight(({ productList, totalCount }) =>
          patchState(store, () => ({
            productList,
            totalCount,
            currentPage: 1,
            hasMore: productList.length < totalCount,
          }))
        );

        patchState(store, () => ({ isLoading: false }));
        return { planExpired, isFreePlan };
      } catch {
        patchState(store, () => ({ isLoading: false }));
        return undefined;
      }
    },

    async loadProducts(slug: string) {
      patchState(store, () => ({ isLoading: true }));

      try {
        const tenantId = store.catalogInfo()?.id
          ? String(store.catalogInfo()!.id)
          : undefined;
        const result = await ecommerceService.getProducts(
          slug,
          store.searchTerm(),
          store.selectedCategoryId() ?? undefined,
          store.orderBy() ?? undefined,
          1,
          PAGE_SIZE,
          tenantId
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
        const tenantId = store.catalogInfo()?.id
          ? String(store.catalogInfo()!.id)
          : undefined;
        const result = await ecommerceService.getProducts(
          slug,
          store.searchTerm(),
          store.selectedCategoryId() ?? undefined,
          store.orderBy() ?? undefined,
          nextPage,
          PAGE_SIZE,
          tenantId
        );

        result.mapRight(({ productList: newProducts, totalCount }) => {
          const currentProducts = store.productList().products;
          const merged = ProductList.from([
            ...currentProducts,
            ...newProducts.products,
          ]);
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

    setHeroLogoVisible(visible: boolean) {
      patchState(store, { heroLogoVisible: visible });
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
      payment_method?: string;
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
        payment_method: order.payment_method,
      });

      patchState(store, () => ({ isLoading: false }));
      return result;
    },

    enterPreviewMode() {
      patchState(store, { isPreviewMode: true });
    },

    exitPreviewMode() {
      patchState(store, { isPreviewMode: false, previewOverrides: null });
    },

    applyPreviewOverrides(overrides: Partial<CatalogInfo>) {
      patchState(store, {
        previewOverrides: { ...store.previewOverrides(), ...overrides },
      });
    },

    reset() {
      patchState(store, () => initialState);
    },
  }))
);

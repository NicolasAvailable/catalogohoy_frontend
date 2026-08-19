import { computed, inject } from '@angular/core';
import { NO_CURRENCY_SYMBOL } from '@catalogohoy/ecommerce-config';
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
  /** El tenant ocultó su categoría "Ver todos" (no renderizar ningún all-tab). */
  viewAllHidden: boolean;
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
  isInfoModalOpen: boolean;
  // Public-catalog product ceiling for free (downgraded) tenants. null = no cap.
  productCap: number | null;
};

const initialState: EcommerceState = {
  catalogInfo: null,
  productList: ProductList.empty(),
  selectedProduct: null,
  categories: [],
  viewAllHidden: false,
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
  isInfoModalOpen: false,
  productCap: null,
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
      // En preview el editor manda el símbolo en cada update; con `!== undefined`
      // un símbolo vacío (o el centinela "sin símbolo") también se aplica, para
      // reflejar en vivo el toggle "mostrar precios sin símbolo de moneda".
      if (store.isPreviewMode() && overrides?.currencySymbol !== undefined) {
        return overrides.currencySymbol === NO_CURRENCY_SYMBOL
          ? ''
          : overrides.currencySymbol;
      }
      return store.catalogInfo()?.currencySymbol ?? '$';
    }),
    showReferencePrice: computed(() => {
      const overrides = store.previewOverrides();
      if (store.isPreviewMode() && overrides?.showReferencePrice !== undefined) {
        return overrides.showReferencePrice;
      }
      return store.catalogInfo()?.showReferencePrice ?? true;
    }),
    showLocalCurrencyPrice: computed(() => {
      const overrides = store.previewOverrides();
      if (store.isPreviewMode() && overrides?.showLocalCurrencyPrice !== undefined) {
        return overrides.showLocalCurrencyPrice;
      }
      return store.catalogInfo()?.showLocalCurrencyPrice ?? true;
    }),
    // Separadores de miles/decimales del tenant (de tenant_currency_config).
    // Los usa el pipe `tenantPrice` para formatear precios según el país:
    // "1.234,50" (VE/AR) vs "1,234.50" (GT/MX/US). Default ',' decimal / '.'
    // miles (mismo default que el mapeo del service).
    numberFormat: computed(() => {
      const cfg = store.catalogInfo()?.currencyConfig;
      return {
        decimalSeparator: cfg?.decimalSeparator || ',',
        thousandSeparator: cfg?.thousandSeparator || '.',
      };
    }),
    // Dual-currency display (Bs. prices alongside USD/EUR) is a
    // Venezuela-specific concept tied to the BCV exchange rate. For every
    // other country, the public catalog must only show the single price.
    isVenezuela: computed(() => {
      const overrides = store.previewOverrides();
      if (store.isPreviewMode() && overrides?.countryCode !== undefined) {
        return overrides.countryCode === 'VE';
      }
      return store.catalogInfo()?.countryCode === 'VE';
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

        const { catalogInfo, categories, viewAllHidden, exchangeRate, planExpired, isFreePlan } =
          catalogResult.value;

        // Free (incl. auto-downgraded) tenants only expose their first N products
        // in the public catalog. Resolve the cap once here and keep it in state
        // so pagination/search/load-more all respect the same ceiling.
        const productCap = isFreePlan
          ? await ecommerceService.getFreePlanMaxProducts()
          : null;

        patchState(store, () => ({
          catalogInfo,
          categories,
          viewAllHidden,
          exchangeRate,
          productCap,
        }));

        // 2. Products query using tenant_id from RPC (no extra tenant lookup)
        const productsResult = await ecommerceService.getProducts(
          slug,
          undefined,
          undefined,
          undefined,
          1,
          PAGE_SIZE,
          String(catalogInfo.id),
          productCap ?? undefined
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
          tenantId,
          store.productCap() ?? undefined
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
          tenantId,
          store.productCap() ?? undefined
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

    openInfoModal() {
      patchState(store, { isInfoModalOpen: true });
    },

    closeInfoModal() {
      patchState(store, { isInfoModalOpen: false });
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
      email?: string;
      payment_method?: string;
      shipping_method?: {
        name: string;
        type: 'pickup' | 'delivery' | 'shipping';
        fee: number;
        priceOnRequest?: boolean;
      } | null;
      shipping_address?: string | null;
      shipping_fee?: number;
      /** Fecha de entrega elegida por el cliente (YYYY-MM-DD). Opcional. */
      delivery_date?: string;
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
        email: order.email,
        payment_method: order.payment_method,
        shipping_method: order.shipping_method,
        shipping_address: order.shipping_address,
        shipping_fee: order.shipping_fee,
        delivery_date: order.delivery_date,
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

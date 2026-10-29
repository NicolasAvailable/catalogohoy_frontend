import { computed, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { MetaPixelService } from '@catalogohoy/core';
import {
  Product,
  ProductAddon,
  ProductVariant,
  WholesaleTier,
} from '@catalogohoy/product';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { toast } from 'ngx-sonner';
import {
  Cart,
  CartChange,
  CartItem,
  divisasPriceOf,
  revalidateCart,
  usesDivisasPromo,
} from '../domain';
import { EcommerceService } from './ecommerce.service';
import { EcommerceStore } from './ecommerce.store';

type CartState = {
  cart: Cart;
  isOpen: boolean;
  isCheckoutOpen: boolean;
  /** Revalidando el carrito contra el servidor (precio/stock actuales). */
  isValidating: boolean;
  /** Cambios encontrados en la última revalidación, para avisar al cliente.
   *  Se limpian cuando el cliente los descarta. */
  changes: CartChange[];
};

const CART_STORAGE_KEY = 'catalogohoy_cart';

function loadCartFromStorage(): Cart {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const items = JSON.parse(stored);
      return Cart.from(items.map((item: any) => CartItem.fromPrimitives(item)));
    }
  } catch {
    // Ignore errors
  }
  return Cart.empty();
}

function saveCartToStorage(cart: Cart): void {
  try {
    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      description: item.description,
      price: item.price,
      photo: item.photo,
      quantity: item.quantity,
      tierTitle: item.tierTitle,
      sku: item.sku,
      size: item.size,
      variantId: item.variantId,
      variantName: item.variantName,
      addons: item.addons,
      divisasPrice: item.divisasPrice,
      // Tope de stock: sin esto se perdía al recargar y el "+" quedaba libre.
      maxStock: item.maxStock,
    }));
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore errors
  }
}

const initialState: CartState = {
  cart: loadCartFromStorage(),
  isOpen: false,
  isCheckoutOpen: false,
  isValidating: false,
  changes: [],
};

/** Resolves Transloco for the buyer-facing stock toasts (key-as-text). Falls
 *  back to identity (the Spanish key itself) when the store is instantiated
 *  outside an Angular injection context — e.g. jest.isolateModules re-requires
 *  the module with a fresh @angular/core whose inject() has no context. */
function injectTranslator(): { translate: (key: string) => string } {
  try {
    return inject(TranslocoService);
  } catch {
    return { translate: (key: string) => key };
  }
}

/** Safe injector for the catalog's tenant id (same fallback rationale as the
 *  translator). Used only for per-catalog gates such as the divisas promo. */
function injectTenantId(): () => number | null {
  try {
    const ecommerceStore = inject(EcommerceStore);
    return () => {
      const id = ecommerceStore.catalogInfo()?.id;
      return id != null ? Number(id) : null;
    };
  } catch {
    return () => null;
  }
}

/** Safe injector for the Meta Pixel (same fallback rationale as the translator:
 *  the store may be instantiated outside an injection context in tests). The
 *  no-op keeps AddToCart tracking best-effort. */
function injectMetaPixel(): Pick<MetaPixelService, 'trackActiveTenant'> {
  try {
    return inject(MetaPixelService);
  } catch {
    return { trackActiveTenant: () => undefined };
  }
}

/** Safe injector for the catalog service (same fallback rationale as the
 *  translator). Without it the cart can't revalidate, so it just skips. */
function injectCartProductsLoader(): Pick<
  EcommerceService,
  'getCartProducts'
> | null {
  try {
    return inject(EcommerceService);
  } catch {
    return null;
  }
}

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalItems: computed(() => store.cart().totalItems),
    totalPrice: computed(() => store.cart().total),
    isEmpty: computed(() => store.cart().isEmpty),
    items: computed(() => store.cart().items),
    /** Ahorro total del carrito si paga en divisas (promo en divisas). */
    divisasSavings: computed(() => {
      const raw = store
        .cart()
        .items.reduce((acc, i) => acc + i.divisasSavings, 0);
      return Math.round(raw * 100) / 100;
    }),
  })),
  withMethods(
    (
      store,
      transloco = injectTranslator(),
      metaPixel = injectMetaPixel(),
      tenantId = injectTenantId(),
      productsLoader = injectCartProductsLoader(),
    ) => {
      /**
       * Revalida el carrito contra los productos ACTUALES (precio, stock,
       * variantes, eliminados). El carrito vive en localStorage y el cliente
       * puede comprar días después de agregar. Actualiza el carrito y deja los
       * cambios en `changes` para avisar. Devuelve los cambios, o `null` si no se
       * pudo consultar (sin red, etc.): ahí se deja el carrito como está y el
       * servidor vuelve a validar al crear la orden.
       */
      const revalidate = async (): Promise<CartChange[] | null> => {
        const tenant = tenantId();
        if (!productsLoader || tenant === null || store.cart().isEmpty) {
          return [];
        }
        patchState(store, () => ({ isValidating: true }));
        try {
          const ids = store.cart().items.map((i) => i.productId);
          const result = await productsLoader.getCartProducts(tenant, ids);
          if (result.isLeft()) return null;
          // Se aplica sobre el carrito de AHORA (pudo cambiar mientras cargaba).
          const { items, changes } = revalidateCart(
            store.cart().items,
            result.value,
            {
              divisasPromo: usesDivisasPromo(tenant),
            },
          );
          if (changes.length) {
            const newCart = Cart.from(items);
            saveCartToStorage(newCart);
            patchState(store, () => ({ cart: newCart, changes }));
          }
          return changes;
        } catch {
          return null;
        } finally {
          patchState(store, () => ({ isValidating: false }));
        }
      };

      return {
        addProduct(
          product: Product,
          options?: {
            size?: string | null;
            variant?: ProductVariant | null;
            addons?: ProductAddon[];
          },
        ) {
          const size = options?.size ?? null;
          const variant = options?.variant ?? null;
          const addons = options?.addons ?? [];

          // Stock que aplica a ESTA selección, de lo más específico a lo general:
          //   variante + talla → stock de esa talla del variante
          //   variante (sin talla) → stock propio del variante
          //   producto con tallas → stock de la talla
          //   producto → stock del producto
          // `null` = ilimitado/no rastreado. (Antes las variantes caían al stock
          // del producto → un variante limitado no se topaba.)
          let effectiveStock: number | null;
          if (variant) {
            const variantSize =
              variant.sizes?.length && size
                ? (variant.sizes.find((s) => s.name === size) ?? null)
                : null;
            effectiveStock = variantSize ? variantSize.stock : variant.stock;
          } else {
            const sizeEntry =
              product.isSized && size
                ? (product.sizes.find((s) => s.name === size) ?? null)
                : null;
            effectiveStock =
              sizeEntry !== null
                ? sizeEntry.stock
                : product.stock !== null
                  ? Number(product.stock)
                  : null;
          }

          if (effectiveStock !== null) {
            if (effectiveStock <= 0) {
              toast.error(transloco.translate('Este producto está agotado'));
              return;
            }
            // Contar por producto + talla + VARIANTE: cada combinación se topa por
            // separado (antes mezclaba variantes bajo el mismo producto).
            const currentInCart = store
              .cart()
              .items.filter(
                (i) =>
                  i.productId === String(product.id) &&
                  i.size === size &&
                  i.variantId === (variant?.id ?? null),
              )
              .reduce((sum, i) => sum + i.quantity, 0);
            if (currentInCart >= effectiveStock) {
              toast.error(
                transloco.translate(
                  'No hay más stock disponible de este producto',
                ),
              );
              return;
            }
          }

          // A variant overrides the price and (when set) the cover image; its
          // name is carried so the cart/order/WhatsApp show "Product (Variant)".
          // Promo en divisas (catálogos de `divisas-promo.ts`): se cobra el precio
          // normal y el promocional queda como precio en divisas de la línea.
          const divisasBase =
            !variant && usesDivisasPromo(tenantId())
              ? divisasPriceOf(product)
              : null;
          const basePrice =
            divisasBase === null && product.pricePromotional > 0
              ? product.pricePromotional
              : product.price;
          const variantPrice = variant ? variant.price : basePrice;
          // Addons SUM on top of the variant/base price for this line's unit price.
          const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
          const price = variantPrice + addonsTotal;
          const divisasPrice =
            divisasBase === null ? null : divisasBase + addonsTotal;
          const photo = (variant?.photos?.[0] || product.photos[0]) ?? '';

          const item = new CartItem(
            String(product.id),
            product.name,
            product.description,
            price,
            photo,
            1,
            null,
            undefined,
            product.sku ?? null,
            size,
            variant?.id ?? null,
            variant?.name ?? null,
            addons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
            effectiveStock,
            divisasPrice,
          );
          const newCart = store.cart().addItem(item);
          saveCartToStorage(newCart);
          patchState(store, () => ({ cart: newCart }));

          // Meta Pixel del catálogo (solo dispara si el tenant tiene pixel + plan
          // pago; si no, es no-op). Aislado del pixel propio de CatalogoHoy.
          metaPixel.trackActiveTenant('AddToCart', {
            content_ids: [String(product.id)],
            content_name: product.name,
            content_type: 'product',
            value: price,
            currency: 'USD',
          });
        },

        addWholesaleProduct(product: Product, tier: WholesaleTier) {
          if (product.stock !== null) {
            const stock = Number(product.stock);
            if (stock <= 0) {
              toast.error(transloco.translate('Este producto está agotado'));
              return;
            }
            const currentInCart = store
              .cart()
              .items.filter((i) => i.productId === String(product.id))
              .reduce((sum, i) => sum + i.quantity, 0);
            if (currentInCart >= stock) {
              toast.error(
                transloco.translate(
                  'No hay más stock disponible de este producto',
                ),
              );
              return;
            }
          }

          const item = new CartItem(
            String(product.id),
            `${product.name} (${tier.title})`,
            product.description,
            tier.price,
            product.photos[0] || '',
            1,
            tier.title,
            undefined,
            product.sku ?? null,
            null,
            null,
            null,
            [],
            product.stock !== null ? Number(product.stock) : null,
          );
          const newCart = store.cart().addItem(item);
          saveCartToStorage(newCart);
          patchState(store, () => ({ cart: newCart }));
          metaPixel.trackActiveTenant('AddToCart', {
            content_ids: [String(product.id)],
            content_name: product.name,
            content_type: 'product',
            value: tier.price,
            currency: 'USD',
          });
        },

        removeItem(itemId: string) {
          const newCart = store.cart().removeItem(itemId);
          saveCartToStorage(newCart);
          patchState(store, () => ({ cart: newCart }));
        },

        incrementItem(itemId: string) {
          // El "+" del carrito respeta el stock: no deja pasar del tope guardado al
          // agregar (antes incrementaba sin límite y se pedían más de las que hay).
          const current = store.cart().items.find((i) => i.id === itemId);
          if (current?.isAtStockLimit) {
            toast.error(
              transloco.translate(
                'No hay más stock disponible de este producto',
              ),
            );
            return;
          }
          const newCart = store.cart().incrementItem(itemId);
          saveCartToStorage(newCart);
          patchState(store, () => ({ cart: newCart }));
        },

        decrementItem(itemId: string) {
          const newCart = store.cart().decrementItem(itemId);
          saveCartToStorage(newCart);
          patchState(store, () => ({ cart: newCart }));
        },

        updateQuantity(itemId: string, quantity: number) {
          // Tope al stock disponible (si la línea lo lleva), avisando al recortar.
          const current = store.cart().items.find((i) => i.id === itemId);
          let qty = quantity;
          if (current?.maxStock != null && qty > current.maxStock) {
            qty = current.maxStock;
            toast.error(
              transloco.translate(
                'No hay más stock disponible de este producto',
              ),
            );
          }
          const newCart = store.cart().updateQuantity(itemId, qty);
          saveCartToStorage(newCart);
          patchState(store, () => ({ cart: newCart }));
        },

        clearCart() {
          const newCart = Cart.empty();
          saveCartToStorage(newCart);
          patchState(store, () => ({ cart: newCart, changes: [] }));
        },

        revalidate,

        dismissChanges() {
          patchState(store, () => ({ changes: [] }));
        },

        openCart() {
          patchState(store, () => ({ isOpen: true, isCheckoutOpen: false }));
          void revalidate();
        },

        closeCart() {
          patchState(store, () => ({ isOpen: false }));
        },

        openCheckout() {
          patchState(store, () => ({ isCheckoutOpen: true }));
        },

        closeCheckout() {
          patchState(store, () => ({ isCheckoutOpen: false }));
        },

        toggleCart() {
          patchState(store, (state) => ({ isOpen: !state.isOpen }));
        },
      };
    },
  ),
);

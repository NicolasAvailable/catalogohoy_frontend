import { computed, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Product, ProductAddon, ProductVariant, WholesaleTier } from '@catalogohoy/product';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { toast } from 'ngx-sonner';
import { Cart, CartItem } from '../domain';

type CartState = {
  cart: Cart;
  isOpen: boolean;
  isCheckoutOpen: boolean;
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

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalItems: computed(() => store.cart().totalItems),
    totalPrice: computed(() => store.cart().total),
    isEmpty: computed(() => store.cart().isEmpty),
    items: computed(() => store.cart().items),
  })),
  withMethods((store, transloco = injectTranslator()) => ({
    addProduct(
      product: Product,
      options?: {
        size?: string | null;
        variant?: ProductVariant | null;
        addons?: ProductAddon[];
      }
    ) {
      const size = options?.size ?? null;
      const variant = options?.variant ?? null;
      const addons = options?.addons ?? [];

      // If the product is sized, prefer per-size stock; otherwise fall back
      // to the product-level stock. Variants share the product-level stock
      // (no per-variant stock). Either way, "no stock" rejects the add.
      const sizeEntry =
        product.isSized && size
          ? product.sizes.find((s) => s.name === size) ?? null
          : null;
      const effectiveStock =
        sizeEntry !== null
          ? sizeEntry.stock
          : product.stock !== null
          ? Number(product.stock)
          : null;

      if (effectiveStock !== null) {
        if (effectiveStock <= 0) {
          toast.error(transloco.translate('Este producto está agotado'));
          return;
        }
        const currentInCart = store
          .cart()
          .items.filter(
            (i) =>
              i.productId === String(product.id) &&
              i.size === size
          )
          .reduce((sum, i) => sum + i.quantity, 0);
        if (currentInCart >= effectiveStock) {
          toast.error(
            transloco.translate('No hay más stock disponible de este producto')
          );
          return;
        }
      }

      // A variant overrides the price and (when set) the cover image; its
      // name is carried so the cart/order/WhatsApp show "Product (Variant)".
      const basePrice =
        product.pricePromotional > 0
          ? product.pricePromotional
          : product.price;
      const variantPrice = variant ? variant.price : basePrice;
      // Addons SUM on top of the variant/base price for this line's unit price.
      const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
      const price = variantPrice + addonsTotal;
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
        addons.map((a) => ({ id: a.id, name: a.name, price: a.price }))
      );
      const newCart = store.cart().addItem(item);
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
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
            transloco.translate('No hay más stock disponible de este producto')
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
        product.sku ?? null
      );
      const newCart = store.cart().addItem(item);
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
    },

    removeItem(itemId: string) {
      const newCart = store.cart().removeItem(itemId);
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
    },

    incrementItem(itemId: string) {
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
      const newCart = store.cart().updateQuantity(itemId, quantity);
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
    },

    clearCart() {
      const newCart = Cart.empty();
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
    },

    openCart() {
      patchState(store, () => ({ isOpen: true, isCheckoutOpen: false }));
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
  }))
);

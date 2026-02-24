import { computed } from '@angular/core';
import { Product } from '@catalogohoy/product';
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

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalItems: computed(() => store.cart().totalItems),
    totalPrice: computed(() => store.cart().total),
    isEmpty: computed(() => store.cart().isEmpty),
    items: computed(() => store.cart().items),
  })),
  withMethods((store) => ({
    addProduct(product: Product) {
      // Check stock before adding
      if (product.stock !== null) {
        const stock = Number(product.stock);
        if (stock <= 0) {
          toast.error('Este producto está agotado');
          return;
        }
        const currentInCart =
          store.cart().items.find((i) => i.productId === String(product.id))
            ?.quantity ?? 0;
        if (currentInCart >= stock) {
          toast.error('No hay más stock disponible de este producto');
          return;
        }
      }

      const item = new CartItem(
        String(product.id),
        product.name,
        product.description,
        product.pricePromotional > 0 ? product.pricePromotional : product.price,
        product.photos[0] || '',
        1
      );
      const newCart = store.cart().addItem(item);
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
    },

    removeItem(productId: string) {
      const newCart = store.cart().removeItem(productId);
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
    },

    incrementItem(productId: string) {
      const newCart = store.cart().incrementItem(productId);
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
    },

    decrementItem(productId: string) {
      const newCart = store.cart().decrementItem(productId);
      saveCartToStorage(newCart);
      patchState(store, () => ({ cart: newCart }));
    },

    updateQuantity(productId: string, quantity: number) {
      const newCart = store.cart().updateQuantity(productId, quantity);
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

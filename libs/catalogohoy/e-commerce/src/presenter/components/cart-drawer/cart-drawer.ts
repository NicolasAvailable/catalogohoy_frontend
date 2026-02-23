import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '@ui';
import { CartItem } from '../../../domain';
import { CartStore } from '../../../infrastructure';

@Component({
  selector: 'lib-cart-drawer',
  imports: [DecimalPipe, IconComponent],
  templateUrl: './cart-drawer.html',
  styleUrl: './cart-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartDrawer {
  public readonly cartStore = inject(CartStore);

  onClose() {
    this.cartStore.closeCart();
  }

  onClearCart() {
    this.cartStore.clearCart();
  }

  onIncrement(item: CartItem) {
    this.cartStore.incrementItem(item.productId);
  }

  onDecrement(item: CartItem) {
    this.cartStore.decrementItem(item.productId);
  }

  onRemove(item: CartItem) {
    this.cartStore.removeItem(item.productId);
  }

  onProceedToCheckout() {
    this.cartStore.openCheckout();
  }
}

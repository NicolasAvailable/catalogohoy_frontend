import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '@ui';
import { CartItem } from '../../../domain';
import { CartStore, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-cart-drawer',
  imports: [DecimalPipe, IconComponent],
  templateUrl: './cart-drawer.html',
  styleUrl: './cart-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartDrawer {
  public readonly cartStore = inject(CartStore);
  public readonly ecommerceStore = inject(EcommerceStore);

  onClose() {
    this.cartStore.closeCart();
  }

  onClearCart() {
    this.cartStore.clearCart();
  }

  onIncrement(item: CartItem) {
    this.cartStore.incrementItem(item.id);
  }

  onDecrement(item: CartItem) {
    this.cartStore.decrementItem(item.id);
  }

  onRemove(item: CartItem) {
    this.cartStore.removeItem(item.id);
  }

  onProceedToCheckout() {
    this.cartStore.openCheckout();
  }
}

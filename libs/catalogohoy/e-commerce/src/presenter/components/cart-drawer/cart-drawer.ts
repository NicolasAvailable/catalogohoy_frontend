import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MetaPixelService } from '@catalogohoy/core';
import { StripHtmlPipe } from '@shared/presenter';
import { IconComponent } from '@ui';
import { CartItem } from '../../../domain';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { TenantPricePipe } from '../../pipes/tenant-price.pipe';

@Component({
  selector: 'lib-cart-drawer',
  imports: [
    DecimalPipe,
    IconComponent,
    StripHtmlPipe,
    TenantPricePipe,
    TranslocoPipe,
  ],
  templateUrl: './cart-drawer.html',
  styleUrl: './cart-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartDrawer {
  public readonly cartStore = inject(CartStore);
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cs = this.ecommerceStore.currencySymbol;
  private readonly router = inject(Router);
  private readonly metaPixel = inject(MetaPixelService);

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
    // Meta Pixel del catálogo: el comprador arranca el checkout (no-op si el
    // catálogo no tiene pixel / plan no pago).
    this.metaPixel.trackActiveTenant('InitiateCheckout', {
      value: this.cartStore.totalPrice(),
      num_items: this.cartStore.totalItems(),
      currency: 'USD',
    });
    this.cartStore.closeCart();
    this.router.navigate(['/checkout'], { queryParamsHandling: 'preserve' });
  }
}

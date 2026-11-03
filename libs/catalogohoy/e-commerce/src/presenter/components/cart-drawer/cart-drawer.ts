import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MetaPixelService } from '@catalogohoy/core';
import { StripHtmlPipe } from '@shared/presenter';
import { IconComponent } from '@ui';
import { CartItem } from '../../../domain';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { parseQuantityInput } from '../../utils/quantity-input';
import { TenantPricePipe } from '../../pipes/tenant-price.pipe';
import { CartChangesNotice } from '../cart-changes-notice/cart-changes-notice';

@Component({
  selector: 'lib-cart-drawer',
  imports: [
    CartChangesNotice,
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

  onQuantityChange(item: CartItem, event: Event) {
    const { input, value } = parseQuantityInput(event);
    if (value !== null) this.cartStore.updateQuantity(item.id, value);
    // El store puede recortar al stock; si el valor final no cambió, el binding
    // no repinta el campo, así que lo sincronizamos a mano.
    const current = this.cartStore.items().find((i) => i.id === item.id);
    if (current) input.value = String(current.quantity);
  }

  onRemove(item: CartItem) {
    this.cartStore.removeItem(item.id);
  }

  async onProceedToCheckout() {
    // Revalida otra vez (pudo pasar un rato desde que abrió el carrito): con
    // cambios, el cliente los ve aquí antes de pagar. Si no hay red se sigue;
    // el servidor vuelve a validar al crear la orden.
    const changes = await this.cartStore.revalidate();
    if (changes?.length || !this.cartStore.hasAvailable()) return;

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

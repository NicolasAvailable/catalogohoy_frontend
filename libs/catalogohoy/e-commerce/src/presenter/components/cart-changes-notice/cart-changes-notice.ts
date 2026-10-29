import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { TenantPricePipe } from '../../pipes/tenant-price.pipe';

/** Aviso al comprador cuando su carrito se actualizó con los datos actuales
 *  (precio nuevo, sin stock, eliminado). Lo usan el carrito y el checkout. */
@Component({
  selector: 'lib-cart-changes-notice',
  imports: [IconComponent, TenantPricePipe, TranslocoPipe],
  templateUrl: './cart-changes-notice.html',
  styleUrl: './cart-changes-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartChangesNotice {
  public readonly cartStore = inject(CartStore);
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cs = this.ecommerceStore.currencySymbol;
}

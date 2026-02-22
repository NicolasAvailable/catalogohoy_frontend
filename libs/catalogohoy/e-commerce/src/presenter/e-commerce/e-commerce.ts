import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PlanStore } from '@catalogohoy/plan';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { CartStore, EcommerceStore } from '../../infrastructure';
import { CartDrawer } from '../components/cart-drawer/cart-drawer';
import { CatalogExpiredComponent } from '../components/catalog-expired/catalog-expired';
import { CatalogHeader } from '../components/catalog-header/catalog-header';
import { CheckoutDrawer } from '../components/checkout-drawer/checkout-drawer';

@Component({
  selector: 'lib-e-commerce',
  imports: [
    RouterOutlet,
    CatalogHeader,
    CartDrawer,
    CheckoutDrawer,
    CatalogExpiredComponent,
  ],
  templateUrl: './e-commerce.html',
  styleUrl: './e-commerce.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ECommerce implements OnInit {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);
  public readonly planStore = inject(PlanStore);

  ngOnInit() {
    const slug = getTenantSlugFromUrl();
    if (slug) {
      this.ecommerceStore.loadCatalog(slug);
      this.planStore.checkExpiredBySlug(slug);
    }
  }
}

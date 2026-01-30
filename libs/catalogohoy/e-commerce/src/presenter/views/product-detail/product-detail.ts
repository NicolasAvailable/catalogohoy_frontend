import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-product-detail',
  imports: [RouterLink, IconComponent],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProductDetail implements OnInit {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  public currentImageIndex = 0;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.ecommerceStore.loadProduct(id);
    }
  }

  get product() {
    return this.ecommerceStore.selectedProduct();
  }

  get displayPrice(): number {
    const p = this.product;
    if (!p) return 0;
    return p.pricePromotional > 0 ? p.pricePromotional : p.price;
  }

  get hasDiscount(): boolean {
    const p = this.product;
    if (!p) return false;
    return p.pricePromotional > 0 && p.pricePromotional < p.price;
  }

  onAddToCart() {
    const p = this.product;
    if (p) {
      this.cartStore.addProduct(p);
      this.cartStore.openCart();
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }

  setImage(index: number) {
    this.currentImageIndex = index;
  }

  get currentImage(): string {
    const p = this.product;
    if (!p || !p.photos.length) return 'assets/placeholder-product.png';
    return p.photos[this.currentImageIndex] || p.photos[0];
  }
}

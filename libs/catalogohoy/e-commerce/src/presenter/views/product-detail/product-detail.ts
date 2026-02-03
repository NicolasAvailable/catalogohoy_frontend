import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
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
  public readonly quantity = signal(1);

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

  get totalPrice(): number {
    return this.displayPrice * this.quantity();
  }

  get hasDiscount(): boolean {
    const p = this.product;
    if (!p) return false;
    return p.pricePromotional > 0 && p.pricePromotional < p.price;
  }

  incrementQuantity() {
    this.quantity.update((q) => q + 1);
  }

  decrementQuantity() {
    this.quantity.update((q) => (q > 1 ? q - 1 : 1));
  }

  onAddToCart() {
    const p = this.product;
    if (p) {
      for (let i = 0; i < this.quantity(); i++) {
        this.cartStore.addProduct(p);
      }
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

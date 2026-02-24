import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Product } from '@catalogohoy/product';
import { DialogService, IconComponent, dialogConfig } from '@ui';
import { CartStore } from '../../../infrastructure';
import { ProductDetailModal } from '../product-detail-modal/product-detail-modal';

@Component({
  selector: 'lib-product-card',
  imports: [IconComponent],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  public readonly product = input.required<Product>();
  public readonly viewMode = input<'grid' | 'list'>('grid');
  private readonly cartStore = inject(CartStore);
  private readonly dialogService = inject(DialogService);

  public readonly isOutOfStock = computed(() => {
    const p = this.product();
    return p.stock !== null && Number(p.stock) <= 0;
  });

  public readonly availableStock = computed(() => {
    const p = this.product();
    return p.stock !== null ? Number(p.stock) : null;
  });

  public readonly cartQuantity = computed(() => {
    const item = this.cartStore
      .items()
      .find((i) => i.productId === String(this.product().id));
    return item?.quantity ?? 0;
  });

  public readonly canIncrement = computed(() => {
    const stock = this.availableStock();
    if (stock === null) return true;
    return this.cartQuantity() < stock;
  });

  openModal(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.dialogService.open(
      ProductDetailModal,
      dialogConfig({
        data: { product: this.product() },
        showHeader: false,
        style: { width: '56rem', maxWidth: '95vw' },
        contentStyle: { padding: '0', overflow: 'hidden' },
      })
    );
  }

  onAddToCart(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.cartStore.addProduct(this.product());
  }

  onIncrement(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.cartStore.incrementItem(String(this.product().id));
  }

  onDecrement(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.cartStore.decrementItem(String(this.product().id));
  }

  get hasDiscount(): boolean {
    const p = this.product();
    return p.pricePromotional > 0 && p.pricePromotional < p.price;
  }
}

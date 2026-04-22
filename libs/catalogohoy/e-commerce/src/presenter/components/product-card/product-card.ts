import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Product } from '@catalogohoy/product';
import { DialogService, IconComponent, dialogConfig } from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { ProductDetailModal } from '../product-detail-modal/product-detail-modal';

@Component({
  selector: 'lib-product-card',
  imports: [DecimalPipe, IconComponent],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  public readonly product = input.required<Product>();
  public readonly viewMode = input<'grid' | 'list'>('grid');
  private readonly cartStore = inject(CartStore);
  public readonly ecommerceStore = inject(EcommerceStore);
  private readonly dialogService = inject(DialogService);

  public readonly cs = computed(() => this.ecommerceStore.currencySymbol());
  public readonly showReferencePrice = this.ecommerceStore.showReferencePrice;
  public readonly showLocalCurrencyPrice = this.ecommerceStore.showLocalCurrencyPrice;

  public readonly isOutOfStock = computed(() => {
    const p = this.product();
    return p.isSoldOut || (p.stock !== null && Number(p.stock) <= 0);
  });

  public readonly isWholesale = computed(() => this.product().isWholesale);

  public readonly minWholesalePrice = computed(() => {
    const tiers = this.product().wholesaleTiers;
    if (!tiers.length) return this.product().price;
    return Math.min(...tiers.map((t) => t.price));
  });

  public readonly availableStock = computed(() => {
    const p = this.product();
    return p.stock !== null ? Number(p.stock) : null;
  });

  public readonly cartQuantity = computed(() => {
    const items = this.cartStore
      .items()
      .filter((i) => i.productId === String(this.product().id));
    return items.reduce((sum, i) => sum + i.quantity, 0);
  });

  private readonly cartItemId = computed(() => {
    const item = this.cartStore
      .items()
      .find((i) => i.productId === String(this.product().id));
    return item?.id ?? null;
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
    const id = this.cartItemId();
    if (id) this.cartStore.incrementItem(id);
  }

  onDecrement(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const id = this.cartItemId();
    if (id) this.cartStore.decrementItem(id);
  }

  get hasDiscount(): boolean {
    const p = this.product();
    return p.pricePromotional > 0 && p.pricePromotional < p.price;
  }
}

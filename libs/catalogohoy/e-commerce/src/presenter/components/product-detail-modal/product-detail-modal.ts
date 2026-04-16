import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Product, WholesaleTier } from '@catalogohoy/product';
import { DynamicDialogConfig, DynamicDialogRef, IconComponent } from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-product-detail-modal',
  imports: [DecimalPipe, IconComponent],
  templateUrl: './product-detail-modal.html',
  styleUrl: './product-detail-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailModal {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);
  private readonly cartStore = inject(CartStore);
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cs = this.ecommerceStore.currencySymbol;
  public readonly showReferencePrice = this.ecommerceStore.showReferencePrice;
  public readonly showLocalCurrencyPrice = this.ecommerceStore.showLocalCurrencyPrice;

  public readonly product: Product = this.config.data.product;
  public readonly currentImageIndex = signal(0);
  public readonly quantity = signal(1);
  public readonly descriptionExpanded = signal(false);

  /**
   * Whether the description is long enough to warrant a "Ver más" toggle.
   * Heuristic: ~50 chars per line × 3 lines = 150 chars, OR 3+ newlines.
   */
  public readonly shouldClampDescription = (() => {
    const desc = this.product.description ?? '';
    if (!desc) return false;
    const newlines = (desc.match(/\n/g) ?? []).length;
    return desc.length > 150 || newlines >= 3;
  })();

  public readonly isClamped = computed(
    () => this.shouldClampDescription && !this.descriptionExpanded()
  );

  toggleDescription(): void {
    if (!this.shouldClampDescription) return;
    this.descriptionExpanded.update((v) => !v);
  }

  public readonly isWholesale =
    this.product.isWholesale && this.product.wholesaleTiers.length > 0;

  public readonly isOutOfStock =
    this.product.isSoldOut || (this.product.stock !== null && Number(this.product.stock) <= 0);

  public readonly availableStock =
    this.product.stock !== null ? Number(this.product.stock) : null;

  public readonly cartQuantity = computed(
    () =>
      this.cartStore
        .items()
        .find((i) => i.productId === String(this.product.id))?.quantity ?? 0
  );

  public readonly canAddMore = computed(() => {
    if (this.availableStock === null) return true;
    return this.cartQuantity() + this.quantity() <= this.availableStock;
  });

  get displayPrice(): number {
    return this.product.pricePromotional > 0
      ? this.product.pricePromotional
      : this.product.price;
  }

  get hasDiscount(): boolean {
    return (
      this.product.pricePromotional > 0 &&
      this.product.pricePromotional < this.product.price
    );
  }

  get currentImage(): string {
    if (!this.product.photos.length) return 'assets/placeholder-product.png';
    return this.product.photos[this.currentImageIndex()] || this.product.photos[0];
  }

  setImage(index: number) {
    this.currentImageIndex.set(index);
  }

  incrementQuantity() {
    if (this.availableStock !== null) {
      const maxCanAdd = this.availableStock - this.cartQuantity();
      if (this.quantity() >= maxCanAdd) return;
    }
    this.quantity.update((q) => q + 1);
  }

  decrementQuantity() {
    this.quantity.update((q) => (q > 1 ? q - 1 : 1));
  }

  close() {
    this.ref.close();
  }

  onAddToCart() {
    for (let i = 0; i < this.quantity(); i++) {
      this.cartStore.addProduct(this.product);
    }
    this.cartStore.openCart();
    this.ref.close();
  }

  onAddTierToCart(tier: WholesaleTier) {
    this.cartStore.addWholesaleProduct(this.product, tier);
    this.cartStore.openCart();
    this.ref.close();
  }
}

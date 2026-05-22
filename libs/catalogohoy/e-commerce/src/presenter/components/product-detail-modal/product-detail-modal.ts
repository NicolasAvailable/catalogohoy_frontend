import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Product, WholesaleTier } from '@catalogohoy/product';
import { isVideoUrl } from '@shared/domain';
import { SafeDescriptionHtmlPipe } from '@shared/presenter';
import {
  DynamicDialogConfig,
  DynamicDialogRef,
  IconComponent,
  ProductMediaComponent,
} from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-product-detail-modal',
  imports: [DecimalPipe, IconComponent, ProductMediaComponent, SafeDescriptionHtmlPipe],
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

  public readonly shouldClampDescription = (() => {
    const desc = this.product.description ?? '';
    if (!desc) return false;
    const text = desc.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const blocks = (desc.match(/<(p|br|li|h[1-6])\b/gi) ?? []).length;
    return text.length > 150 || blocks >= 3;
  })();

  public readonly isClamped = computed(
    () => this.shouldClampDescription && !this.descriptionExpanded()
  );

  private readonly descriptionEl = viewChild<ElementRef<HTMLElement>>('descriptionEl');
  private readonly carouselEl = viewChild<ElementRef<HTMLElement>>('carousel');
  private carouselScrollTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressScrollSync = false;

  // Reset the inner scroll position when the description collapses so the
  // clamped preview always shows the start of the text, not whatever the
  // user had scrolled into view.
  private readonly resetScrollOnCollapse = effect(() => {
    if (this.descriptionExpanded()) return;
    const el = this.descriptionEl()?.nativeElement;
    if (el) el.scrollTop = 0;
  });

  toggleDescription(): void {
    if (!this.shouldClampDescription) return;
    this.descriptionExpanded.update((v) => !v);
  }

  /** Expands the description from the clamped state. Bound to the wrap's
   *  click/Enter/Space when clamped only — once expanded, the inner
   *  description scrolls and a dedicated "Ver menos" button collapses it. */
  onWrapActivate(event: Event): void {
    if (!this.shouldClampDescription || this.descriptionExpanded()) return;
    if (event.type === 'keydown') event.preventDefault();
    this.descriptionExpanded.set(true);
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

  get currentIsVideo(): boolean {
    return isVideoUrl(this.currentImage);
  }

  isVideoUrl(url: string): boolean {
    return isVideoUrl(url);
  }

  setImage(index: number) {
    this.currentImageIndex.set(index);
    const el = this.carouselEl()?.nativeElement;
    if (!el) return;
    // Programmatic scroll: suppress the scroll handler so the smooth
    // animation doesn't ping-pong the index back as it crosses slides.
    this.suppressScrollSync = true;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    if (this.carouselScrollTimer) clearTimeout(this.carouselScrollTimer);
    this.carouselScrollTimer = setTimeout(() => {
      this.suppressScrollSync = false;
    }, 400);
  }

  /** Debounced scroll handler — updates the active index after the user
   *  has stopped scrolling so we don't fight the snap animation. */
  onCarouselScroll(): void {
    if (this.suppressScrollSync) return;
    if (this.carouselScrollTimer) clearTimeout(this.carouselScrollTimer);
    this.carouselScrollTimer = setTimeout(() => {
      const el = this.carouselEl()?.nativeElement;
      if (!el || el.clientWidth === 0) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      if (index !== this.currentImageIndex()) this.currentImageIndex.set(index);
    }, 80);
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

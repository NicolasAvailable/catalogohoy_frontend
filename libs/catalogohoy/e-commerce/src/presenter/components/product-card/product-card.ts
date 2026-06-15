import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Product } from '@catalogohoy/product';
import { firstImageUrl, isVideoUrl } from '@shared/domain';
import { StripHtmlPipe } from '@shared/presenter';
import {
  DialogService,
  IconComponent,
  ProductMediaComponent,
  dialogConfig,
} from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { ProductDetailModal } from '../product-detail-modal/product-detail-modal';

@Component({
  selector: 'lib-product-card',
  imports: [DecimalPipe, IconComponent, ProductMediaComponent, StripHtmlPipe],
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

  // Cover for the grid card. Prefer an image so the grid stays cheap to
  // render (no <video> elements opening media decoders per card). Only
  // when EVERY media is a video does this fall back to the first video
  // URL — the browser will show its first frame via the <video> tag's
  // poster behavior.
  public readonly coverUrl = computed(() => {
    const list = this.product().photos ?? [];
    return firstImageUrl(list) ?? list[0] ?? '';
  });

  public readonly hasVideo = computed(() =>
    (this.product().photos ?? []).some((url) => isVideoUrl(url))
  );

  public readonly isOutOfStock = computed(() => {
    const p = this.product();
    return p.isSoldOut || (p.stock !== null && Number(p.stock) <= 0);
  });

  public readonly isWholesale = computed(() => this.product().isWholesale);

  /** Products with sizes need a size picked before adding, so the card's
   *  "Agregar" button delegates to the modal where the buyer can choose. */
  public readonly isSized = computed(
    () => this.product().isSized && this.product().sizes.length > 0
  );

  /** Size labels that are still in stock (null stock = unlimited). Shown as
   *  chips on the card so buyers see availability without opening the modal. */
  public readonly availableSizes = computed(() =>
    this.product()
      .sizes.filter((s) => s.stock === null || s.stock > 0)
      .map((s) => s.name)
  );

  private static readonly MAX_VISIBLE_SIZES = 4;

  public readonly visibleSizes = computed(() =>
    this.availableSizes().slice(0, ProductCard.MAX_VISIBLE_SIZES)
  );

  public readonly extraSizesCount = computed(() =>
    Math.max(0, this.availableSizes().length - ProductCard.MAX_VISIBLE_SIZES)
  );

  public readonly minWholesalePrice = computed(() => {
    const tiers = this.product().wholesaleTiers;
    if (!tiers.length) return this.product().price;
    return Math.min(...tiers.map((t) => t.price));
  });

  /** Products with variants need the buyer to pick one in the modal (each
   *  variant has its own price), so the card delegates to "Ver más". */
  public readonly isVariant = computed(
    () => this.product().isVariant && this.product().variants.length > 0
  );

  /** Min/max price across variants — the card shows a range like TakeApp. */
  public readonly variantPriceRange = computed(() => {
    const prices = this.product().variants.map((v) => v.price);
    if (!prices.length) {
      return { min: this.product().price, max: this.product().price };
    }
    return { min: Math.min(...prices), max: Math.max(...prices) };
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

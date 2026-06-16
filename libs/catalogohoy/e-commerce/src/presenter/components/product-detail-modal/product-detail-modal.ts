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
import { Product, ProductVariant, WholesaleTier } from '@catalogohoy/product';
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
  public readonly selectedSize = signal<string | null>(null);

  /** Aspect ratios reportados por cada slide cuando carga la imagen o el
   *  video (clave = índice del slide en `product.photos`, valor = w/h).
   *  El container del carrusel usa el ratio del slide actual para que cada
   *  foto/video se vea con su formato real — vertical, horizontal o
   *  cuadrado — sin recortar. */
  private readonly slideAspects = signal<Map<number, number>>(new Map());

  /** Aspect ratio del slide visible ahora. Cae a 4/5 (un poco vertical) si
   *  el slide actual todavía no reportó dimensiones — eso reduce el "salto"
   *  visual cuando los media cargan. */
  public readonly currentSlideAspect = computed(() => {
    const real = this.slideAspects().get(this.currentImageIndex());
    return real ?? 4 / 5;
  });

  public setSlideAspect(index: number, ratio: number): void {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    this.slideAspects.update((map) => {
      const next = new Map(map);
      next.set(index, ratio);
      return next;
    });
  }

  public readonly isSized = this.product.isSized && this.product.sizes.length > 0;

  public readonly isVariant =
    this.product.isVariant && this.product.variants.length > 0;

  /** Sentinel id for the synthetic "Producto original" option. */
  private static readonly BASE_ID = '__base__';

  /** True when at least one size belongs to the base/original product. */
  private readonly hasBaseSizes =
    this.isSized && this.product.sizes.some((s) => !s.variantId);

  /** Options shown in the public selector: the base/original product (only
   *  when it has its own sizes) followed by the real variants. The base uses
   *  the product's own price and media. */
  public readonly selectorOptions: ProductVariant[] = (() => {
    const options: ProductVariant[] = [];
    if (this.isVariant && this.hasBaseSizes) {
      const hasPromo = this.product.pricePromotional > 0;
      options.push({
        id: ProductDetailModal.BASE_ID,
        name: 'Producto original',
        price: hasPromo ? this.product.pricePromotional : this.product.price,
        originalPrice: hasPromo ? this.product.price : 0,
        photos: this.product.photos,
      });
    }
    options.push(...this.product.variants);
    return options;
  })();

  /** Defaults to the first option so a price is always shown on open. */
  public readonly selectedVariant = signal<ProductVariant | null>(
    this.isVariant ? this.selectorOptions[0] : null
  );

  /** Variant id for the current selection, normalising the base sentinel to
   *  null (the base/original product is stored without a variant). */
  private selectedVariantId(): string | null {
    const id = this.selectedVariant()?.id ?? null;
    return id === ProductDetailModal.BASE_ID ? null : id;
  }

  selectVariant(variant: ProductVariant): void {
    this.selectedVariant.set(variant);
    // The available sizes change per variant, so drop the size selection.
    this.selectedSize.set(null);
    this.quantity.set(1);
    // The gallery swaps to the variant's own media — reset to the first slide.
    this.currentImageIndex.set(0);
  }

  /** Media shown in the gallery: the selected variant's own photos/videos when
   *  it has any, otherwise the product's media. */
  public readonly galleryMedia = computed(() => {
    const v = this.selectedVariant();
    return v && v.photos?.length ? v.photos : this.product.photos;
  });

  /** Sizes shown for the current selection. With variants, only the sizes that
   *  belong to the selected variant (variantId match, or unassigned ones). */
  public readonly availableSizes = computed(() => {
    if (!this.isSized) return [];
    if (!this.isVariant) return this.product.sizes;
    const sel = this.selectedVariant()?.id ?? null;
    if (sel === ProductDetailModal.BASE_ID) {
      // The "Producto original" option only shows base-assigned sizes.
      return this.product.sizes.filter((s) => !s.variantId);
    }
    return this.product.sizes.filter((s) => s.variantId === sel);
  });

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

  /** Stock available for the currently-selected size (or the product-level
   *  stock when the product isn't sized / no size selected yet). `null`
   *  means unlimited. */
  public readonly effectiveStock = computed(() => {
    if (this.isSized) {
      const size = this.selectedSize();
      if (!size) return null;
      const entry = this.availableSizes().find((s) => s.name === size);
      return entry?.stock ?? null;
    }
    return this.availableStock;
  });

  public readonly cartQuantity = computed(() => {
    const size = this.selectedSize();
    const vid = this.selectedVariantId();
    return this.cartStore
      .items()
      .filter(
        (i) =>
          i.productId === String(this.product.id) &&
          (this.isSized ? i.size === size : true) &&
          (this.isVariant ? i.variantId === vid : true)
      )
      .reduce((sum, i) => sum + i.quantity, 0);
  });

  public readonly canAddMore = computed(() => {
    const stock = this.effectiveStock();
    if (stock === null) return true;
    return this.cartQuantity() + this.quantity() <= stock;
  });

  public readonly canSubmit = computed(() => {
    if (this.isSized && !this.selectedSize()) return false;
    if (this.isVariant && !this.selectedVariant()) return false;
    return this.canAddMore();
  });

  public readonly isSizeOutOfStock = (sizeName: string): boolean => {
    const entry = this.availableSizes().find((s) => s.name === sizeName);
    if (!entry || entry.stock === null) return false;
    return entry.stock <= 0;
  };

  selectSize(name: string): void {
    if (this.isSizeOutOfStock(name)) return;
    this.selectedSize.set(name);
    // Quantity may exceed the new size's stock — clamp back to 1 when
    // switching sizes for safety.
    this.quantity.set(1);
  }

  get displayPrice(): number {
    if (this.isVariant) {
      return this.selectedVariant()?.price ?? this.product.price;
    }
    return this.product.pricePromotional > 0
      ? this.product.pricePromotional
      : this.product.price;
  }

  /** Struck-through "before" price for the current selection. */
  get originalDisplayPrice(): number {
    if (this.isVariant) return this.selectedVariant()?.originalPrice ?? 0;
    return this.product.price;
  }

  get hasDiscount(): boolean {
    if (this.isVariant) {
      const v = this.selectedVariant();
      return !!v && v.originalPrice > 0 && v.originalPrice > v.price;
    }
    return (
      this.product.pricePromotional > 0 &&
      this.product.pricePromotional < this.product.price
    );
  }

  get currentImage(): string {
    const media = this.galleryMedia();
    if (!media.length) return 'assets/placeholder-product.png';
    return media[this.currentImageIndex()] || media[0];
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
    if (this.isSized && !this.selectedSize()) return;
    if (this.isVariant && !this.selectedVariant()) return;
    const sel = this.selectedVariant();
    // The base/original option carries no real variant — add at the base price.
    const variant = sel && sel.id !== ProductDetailModal.BASE_ID ? sel : null;
    for (let i = 0; i < this.quantity(); i++) {
      this.cartStore.addProduct(this.product, {
        size: this.selectedSize(),
        variant,
      });
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

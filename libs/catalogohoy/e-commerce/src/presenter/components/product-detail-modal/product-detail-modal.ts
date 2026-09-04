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
import { Product, ProductAddon, ProductVariant, WholesaleTier } from '@catalogohoy/product';
import { TranslocoPipe } from '@jsverse/transloco';
import { isVideoUrl } from '@shared/domain';
import { SafeDescriptionHtmlPipe } from '@shared/presenter';
import {
  DynamicDialogConfig,
  DynamicDialogRef,
  IconComponent,
  ImageComponent,
  ProductMediaComponent,
} from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { TenantPricePipe } from '../../pipes/tenant-price.pipe';

@Component({
  selector: 'lib-product-detail-modal',
  imports: [
    DecimalPipe,
    IconComponent,
    ImageComponent,
    ProductMediaComponent,
    SafeDescriptionHtmlPipe,
    TenantPricePipe,
    TranslocoPipe,
  ],
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

  /** Optional paid extras the buyer can add. Multi-select: their prices sum
   *  on top of the selected variant/base price. */
  public readonly addons: ProductAddon[] = this.product.addons ?? [];
  public readonly hasAddons = this.addons.length > 0;

  /** Ids of the addons currently checked. Seeded with any default-on addons. */
  public readonly selectedAddonIds = signal<Set<string>>(
    new Set(this.addons.filter((a) => a.isDefault).map((a) => a.id))
  );

  public isAddonSelected(id: string): boolean {
    return this.selectedAddonIds().has(id);
  }

  toggleAddon(addon: ProductAddon): void {
    this.selectedAddonIds.update((set) => {
      const next = new Set(set);
      if (next.has(addon.id)) next.delete(addon.id);
      else next.add(addon.id);
      return next;
    });
  }

  /** Sum of the prices of the currently-selected addons (per unit). */
  public readonly addonsTotal = computed(() => {
    const ids = this.selectedAddonIds();
    return this.addons
      .filter((a) => ids.has(a.id))
      .reduce((sum, a) => sum + a.price, 0);
  });

  public readonly selectedAddons = computed(() => {
    const ids = this.selectedAddonIds();
    return this.addons.filter((a) => ids.has(a.id));
  });

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

  /** Los slides de imagen renderizan via ui-image (p-image no expone load),
   *  así que las dimensiones para `--media-aspect` se miden acá preloadeando.
   *  El browser cachea, no hay fetch duplicado. Videos siguen reportando por
   *  (aspectChange) de ui-product-media. */
  private readonly preloadAspects = effect(() => {
    this.galleryMedia().forEach((url, index) => {
      if (isVideoUrl(url)) return;
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          this.setSlideAspect(index, img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = url;
    });
  });

  public readonly isSized = this.product.isSized && this.product.sizes.length > 0;

  public readonly isVariant =
    this.product.isVariant && this.product.variants.length > 0;

  /** Sentinel id for the synthetic "Producto original" option. */
  private static readonly BASE_ID = '__base__';

  /** Exposed for the template: the base option's label ('Producto original')
   *  is app copy and gets translated at render; real variant names are tenant
   *  data and render as-is. */
  public readonly baseOptionId = ProductDetailModal.BASE_ID;

  /** Options shown in the public selector: the base/original product ALWAYS
   *  first, followed by the real variants. The base uses the product's own
   *  price, media and sizes (its sizes may be empty). Opening a product with
   *  variants therefore lands on the original product by default — the buyer
   *  then switches to a variant if they want. */
  public readonly selectorOptions: ProductVariant[] = (() => {
    const options: ProductVariant[] = [];
    if (this.isVariant) {
      const hasPromo = this.product.pricePromotional > 0;
      options.push({
        id: ProductDetailModal.BASE_ID,
        name: 'Producto original',
        price: hasPromo ? this.product.pricePromotional : this.product.price,
        originalPrice: hasPromo ? this.product.price : 0,
        photos: this.product.photos,
        // La base (producto original) usa el stock a nivel de producto, para
        // que effectiveStock lo respete al seleccionarla.
        stock: this.product.stock !== null ? Number(this.product.stock) : null,
        sizes: this.product.sizes,
      });
    }
    options.push(...this.product.variants);
    return options;
  })();

  /** Defaults to the base/original product so clicking a product always opens
   *  on the product itself, not a variant. */
  public readonly selectedVariant = signal<ProductVariant | null>(
    this.isVariant ? this.selectorOptions[0] : null
  );

  /** Variant id for the current selection, normalising the base sentinel to
   *  null (the base/original product is stored without a variant). */
  private selectedVariantId(): string | null {
    const id = this.selectedVariant()?.id ?? null;
    return id === ProductDetailModal.BASE_ID ? null : id;
  }

  /** Name of the REAL variant selected (null for the base/original product).
   *  Shown under the title so the buyer sees they're purchasing that option,
   *  not the whole original product at the variant's price. */
  get selectedOptionName(): string | null {
    const v = this.selectedVariant();
    if (!v || v.id === ProductDetailModal.BASE_ID) return null;
    return v.name;
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

  /** Sizes shown for the current selection: the selected option owns its own
   *  sizes (the base/original option carries the product's sizes). */
  public readonly availableSizes = computed(() => {
    if (this.isVariant) return this.selectedVariant()?.sizes ?? [];
    return this.isSized ? this.product.sizes : [];
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
    if (this.availableSizes().length) {
      const size = this.selectedSize();
      if (!size) return null;
      const entry = this.availableSizes().find((s) => s.name === size);
      return entry?.stock ?? null;
    }
    // Variante sin tallas: usa el stock propio del variante cuando lo lleva
    // (null = ilimitado). Antes caía siempre al stock del producto (compartido).
    if (this.isVariant) {
      const v = this.selectedVariant();
      if (!v) return null;
      return v.stock ?? null;
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
          (this.availableSizes().length ? i.size === size : true) &&
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
    if (this.availableSizes().length && !this.selectedSize()) return false;
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

  /** Base/variant price for the current selection, WITHOUT addons. */
  get basePrice(): number {
    if (this.isVariant) {
      return this.selectedVariant()?.price ?? this.product.price;
    }
    return this.product.pricePromotional > 0
      ? this.product.pricePromotional
      : this.product.price;
  }

  /** Header price = base/variant price. Addons never alter it; they only
   *  show in the footer total (unitTotal). */
  get displayPrice(): number {
    return this.basePrice;
  }

  /** Charged per unit = base/variant price + selected addons. */
  get unitTotal(): number {
    return this.basePrice + this.addonsTotal();
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

  /** Feedback del botón compartir: el icono pasa a check ~2s tras copiar. */
  public readonly linkCopied = signal(false);

  /** Copia el link directo del producto (`?product={id}`, el mismo patrón
   *  que el botón compartir del listado de productos del admin). Se parte de
   *  la URL actual para preservar el slug del tenant en dev y subdominios. */
  async shareProduct(): Promise<void> {
    const url = new URL(window.location.href);
    url.searchParams.set('product', String(this.product.id));
    try {
      await navigator.clipboard?.writeText(url.toString());
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 1800);
    } catch {
      /* clipboard puede no estar disponible en navegadores muy viejos */
    }
  }

  /** Abre el preview fullscreen del slide visible. p-image no expone API
   *  programática, así que se dispara su botón interno (.p-image-preview-mask,
   *  el mismo que se clickea con el hover en desktop). */
  openImagePreview(): void {
    const slides = this.carouselEl()?.nativeElement.querySelectorAll(
      '.pdm__carousel-slide'
    );
    const slide = slides?.[this.currentImageIndex()];
    slide
      ?.querySelector<HTMLButtonElement>('.p-image-preview-mask')
      ?.click();
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
    if (this.availableSizes().length && !this.selectedSize()) return;
    if (this.isVariant && !this.selectedVariant()) return;
    const sel = this.selectedVariant();
    // The base/original option carries no real variant — add at the base price.
    const variant = sel && sel.id !== ProductDetailModal.BASE_ID ? sel : null;
    const addons = this.selectedAddons();
    for (let i = 0; i < this.quantity(); i++) {
      this.cartStore.addProduct(this.product, {
        size: this.selectedSize(),
        variant,
        addons,
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

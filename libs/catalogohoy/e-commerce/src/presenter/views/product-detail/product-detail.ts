import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { isVideoUrl } from '@shared/domain';
import { SafeDescriptionHtmlPipe, StripHtmlPipe } from '@shared/presenter';
import { IconComponent, ProductMediaComponent } from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { TenantPricePipe } from '../../pipes/tenant-price.pipe';

@Component({
  selector: 'lib-product-detail',
  imports: [
    DecimalPipe,
    RouterLink,
    IconComponent,
    ProductMediaComponent,
    SafeDescriptionHtmlPipe,
    TenantPricePipe,
    TranslocoPipe,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProductDetail implements OnInit {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);
  // Símbolo de moneda del tenant (antes esta vista usaba '$' hardcodeado).
  public readonly cs = this.ecommerceStore.currencySymbol;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly stripHtmlPipe = new StripHtmlPipe();

  public currentImageIndex = 0;
  public readonly quantity = signal(1);

  constructor() {
    effect(() => {
      const product = this.ecommerceStore.selectedProduct();
      const catalogInfo = this.ecommerceStore.effectiveCatalogInfo();
      if (!product) return;

      const storeName = catalogInfo?.name || 'CatalogoHoy';
      const title = `${product.name} — ${storeName}`;
      const plainDescription = this.stripHtmlPipe.transform(product.description);
      const description = plainDescription
        ? plainDescription.slice(0, 160)
        : `${product.name} disponible en ${storeName}`;
      const image = product.photos.length > 0 ? product.photos[0] : (catalogInfo?.logo || '');
      const url = window.location.href;
      const price = product.pricePromotional > 0 ? product.pricePromotional : product.price;

      this.titleService.setTitle(title);

      this.metaService.updateTag({ name: 'description', content: description });
      this.metaService.updateTag({ property: 'og:title', content: title });
      this.metaService.updateTag({ property: 'og:description', content: `$${price.toFixed(2)} · ${description}` });
      this.metaService.updateTag({ property: 'og:image', content: image });
      this.metaService.updateTag({ property: 'og:url', content: url });
      this.metaService.updateTag({ property: 'og:type', content: 'product' });
      this.metaService.updateTag({ name: 'twitter:title', content: title });
      this.metaService.updateTag({ name: 'twitter:description', content: `$${price.toFixed(2)} · ${description}` });
      this.metaService.updateTag({ name: 'twitter:image', content: image });

      this.updateJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: plainDescription || undefined,
        image: product.photos.length > 0 ? product.photos : undefined,
        url,
        offers: {
          '@type': 'Offer',
          price: price.toFixed(2),
          priceCurrency: 'USD',
          availability: product.stock === null || Number(product.stock) > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      });
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.ecommerceStore.loadProduct(id);
    }
  }

  private updateJsonLd(data: Record<string, unknown>): void {
    const head = this.document.head;
    let script: HTMLScriptElement | null = head.querySelector('script[type="application/ld+json"]');
    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
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
    return Math.round(this.displayPrice * this.quantity() * 100) / 100;
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

  get currentIsVideo(): boolean {
    return isVideoUrl(this.currentImage);
  }

  isVideoUrl(url: string): boolean {
    return isVideoUrl(url);
  }
}

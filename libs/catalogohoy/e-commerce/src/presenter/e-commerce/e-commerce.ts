import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  effect,
  DOCUMENT,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { PlanStore } from '@catalogohoy/plan';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { CartStore, EcommerceStore } from '../../infrastructure';
import { CartDrawer } from '../components/cart-drawer/cart-drawer';
import { CatalogExpiredComponent } from '../components/catalog-expired/catalog-expired';
import { CatalogHeader } from '../components/catalog-header/catalog-header';
import { CheckoutDrawer } from '../components/checkout-drawer/checkout-drawer';

const DEFAULT_FAVICON =
  'https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/favicon-c.png';

@Component({
  selector: 'lib-e-commerce',
  imports: [
    RouterOutlet,
    CatalogHeader,
    CartDrawer,
    CheckoutDrawer,
    CatalogExpiredComponent,
  ],
  templateUrl: './e-commerce.html',
  styleUrl: './e-commerce.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ECommerce implements OnInit, OnDestroy {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);
  public readonly planStore = inject(PlanStore);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);

  private readonly handlePreviewMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const msg = event.data;
    if (msg?.source !== 'catalogohoy-admin') return;

    switch (msg.type) {
      case 'PREVIEW_ENTER':
        this.ecommerceStore.enterPreviewMode();
        break;
      case 'PREVIEW_EXIT':
        this.ecommerceStore.exitPreviewMode();
        break;
      case 'PREVIEW_UPDATE':
        this.ecommerceStore.enterPreviewMode();
        this.ecommerceStore.applyPreviewOverrides(msg.payload);
        break;
    }
  };

  constructor() {
    // Dynamic title + SEO meta tags
    effect(() => {
      const info = this.ecommerceStore.effectiveCatalogInfo();
      if (info?.name) {
        const title = `${info.name} | Catálogo`;
        const description = info.description || `Explora el catálogo de ${info.name}`;
        const image = info.logo || info.banner || DEFAULT_FAVICON;
        const url = window.location.origin;

        this.titleService.setTitle(title);

        this.metaService.updateTag({ name: 'description', content: description });
        this.metaService.updateTag({ property: 'og:title', content: title });
        this.metaService.updateTag({ property: 'og:description', content: description });
        this.metaService.updateTag({ property: 'og:image', content: image });
        this.metaService.updateTag({ property: 'og:url', content: url });
        this.metaService.updateTag({ property: 'og:type', content: 'website' });
        this.metaService.updateTag({ name: 'twitter:title', content: title });
        this.metaService.updateTag({ name: 'twitter:description', content: description });
        this.metaService.updateTag({ name: 'twitter:image', content: image });

        this.updateCanonical(url);
        this.updateJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Store',
          name: info.name,
          description,
          url,
          ...(info.logo ? { logo: info.logo } : {}),
          ...(info.banner ? { image: info.banner } : {}),
        });
      }
    });

    // Dynamic favicon + cache logo for splash screen
    effect(() => {
      const info = this.ecommerceStore.effectiveCatalogInfo();
      if (!info) return; // Wait until catalog info is loaded
      const logoUrl = info.logo;
      this.updateFavicon(logoUrl ?? null);
      // Cache logo for splash screen on next visit
      if (logoUrl) {
        localStorage.setItem('splash-logo', logoUrl);
      }
    });

    // Dynamic theme color — generate full palette from base color
    effect(() => {
      const info = this.ecommerceStore.effectiveCatalogInfo();
      if (info?.themeColor) {
        this.applyThemePalette(info.themeColor);
      }
    });
  }

  ngOnInit() {
    const slug = getTenantSlugFromUrl();
    if (slug) {
      this.ecommerceStore.loadCatalog(slug);
      this.planStore.checkExpiredBySlug(slug);
    }

    window.addEventListener('message', this.handlePreviewMessage);
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.handlePreviewMessage);
    if (this.ecommerceStore.isPreviewMode()) {
      this.ecommerceStore.exitPreviewMode();
    }
  }

  private applyThemePalette(baseColor: string): void {
    const rgb = this.hexToRgb(baseColor);
    if (!rgb) return;

    const el = document.documentElement;
    const tint = (pct: number) => this.mixWithWhite(rgb, pct);
    const shade = (pct: number) => this.mixWithBlack(rgb, pct);

    el.style.setProperty('--color-primary-50', tint(0.92));
    el.style.setProperty('--color-primary-100', tint(0.85));
    el.style.setProperty('--color-primary-200', tint(0.70));
    el.style.setProperty('--color-primary-300', tint(0.50));
    el.style.setProperty('--color-primary-400', tint(0.25));
    el.style.setProperty('--color-primary-500', baseColor);
    el.style.setProperty('--color-primary-600', shade(0.15));
    el.style.setProperty('--color-primary-700', shade(0.30));
    el.style.setProperty('--color-primary-800', shade(0.50));
    el.style.setProperty('--color-primary-900', shade(0.65));
  }

  private hexToRgb(hex: string): [number, number, number] | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }

  private mixWithWhite([r, g, b]: [number, number, number], amount: number): string {
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    return `#${[mix(r), mix(g), mix(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }

  private mixWithBlack([r, g, b]: [number, number, number], amount: number): string {
    const mix = (c: number) => Math.round(c * (1 - amount));
    return `#${[mix(r), mix(g), mix(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }

  private updateFavicon(logoUrl: string | null): void {
    const url = logoUrl ?? DEFAULT_FAVICON;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 64;
      const radius = 4 * (size / 32); // scale radius relative to favicon size
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, radius);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, size, size);

      this.setFaviconHref(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      this.setFaviconHref(url);
    };
    img.src = url;
  }

  private setFaviconHref(href: string): void {
    let link: HTMLLinkElement | null =
      document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = href;
  }

  private updateCanonical(url: string): void {
    const head = this.document.head;
    let link: HTMLLinkElement | null = head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
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
}

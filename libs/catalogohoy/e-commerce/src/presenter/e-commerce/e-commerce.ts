import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { StripHtmlPipe } from '@shared/presenter';
import { PosthogService } from '@catalogohoy/core';
import { PlanStore } from '@catalogohoy/plan';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { DialogService, IconComponent, dialogConfig } from '@ui';
import { CartStore, EcommerceService, EcommerceStore } from '../../infrastructure';
import { ProductDetailModal } from '../components/product-detail-modal/product-detail-modal';
import { CartDrawer } from '../components/cart-drawer/cart-drawer';
import { CatalogFooter } from '../components/catalog-footer/catalog-footer';
import { CatalogHeader } from '../components/catalog-header/catalog-header';
import { CatalogHero } from '../components/catalog-hero/catalog-hero';
import { CatalogInfoModal } from '../components/catalog-info-modal/catalog-info-modal';

const DEFAULT_FAVICON =
  'https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/favicon-c.png';

@Component({
  selector: 'lib-e-commerce',
  imports: [
    RouterOutlet,
    NgClass,
    IconComponent,
    CatalogHeader,
    CatalogHero,
    CatalogFooter,
    CartDrawer,
    CatalogInfoModal,
  ],
  templateUrl: './e-commerce.html',
  styleUrl: './e-commerce.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ECommerce implements OnInit, OnDestroy {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);
  public readonly planStore = inject(PlanStore);
  private readonly posthogService = inject(PosthogService);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly stripHtmlPipe = new StripHtmlPipe();
  private readonly document = inject(DOCUMENT);
  private readonly ecommerceService = inject(EcommerceService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  /** Checkout and invoice are full-page flows — hide the catalog chrome
   *  (header/hero/cart-pill/footer) so they don't show their loading skeleton
   *  and action buttons around those routes. */
  public readonly isStandaloneRoute = signal(this.matchStandalone(this.router.url));

  private matchStandalone(url: string): boolean {
    const path = (url.split('?')[0] || '').replace(/\/$/, '');
    return path === '/checkout' || /\/order\/[^/]+\/invoice$/.test(path);
  }

  public readonly whatsappUrl = computed(() => {
    const btn = this.ecommerceStore.effectiveCatalogInfo()?.whatsappButtons?.[0];
    if (!btn?.number) return '#';
    const phone = String(btn.number).replace(/\D/g, '');
    return `https://wa.me/${phone}`;
  });

  public async onShare(): Promise<void> {
    const info = this.ecommerceStore.effectiveCatalogInfo();
    const shareData = {
      title: info?.name ?? 'Catálogo',
      text: info?.description ?? '',
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard?.writeText(window.location.href);
    }
  }

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
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.isStandaloneRoute.set(this.matchStandalone(e.urlAfterRedirects));
      }
    });

    // Dynamic title + SEO meta tags
    effect(() => {
      const info = this.ecommerceStore.effectiveCatalogInfo();
      if (info?.name) {
        const title = `${info.name} | Catálogo`;
        // description is now rich HTML — strip tags for meta/share previews.
        const plainDescription = this.stripHtmlPipe
          .transform(info.description ?? '')
          .trim();
        const description =
          plainDescription || `Explora el catálogo de ${info.name}`;
        const image = info.logo || info.banner || DEFAULT_FAVICON;
        const url = window.location.origin;

        this.titleService.setTitle(title);

        this.metaService.updateTag({
          name: 'description',
          content: description,
        });
        this.metaService.updateTag({ property: 'og:title', content: title });
        this.metaService.updateTag({
          property: 'og:description',
          content: description,
        });
        this.metaService.updateTag({ property: 'og:image', content: image });
        this.metaService.updateTag({ property: 'og:url', content: url });
        this.metaService.updateTag({ property: 'og:type', content: 'website' });
        this.metaService.updateTag({ name: 'twitter:title', content: title });
        this.metaService.updateTag({
          name: 'twitter:description',
          content: description,
        });
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

  async ngOnInit() {
    // Snapshot del `?product=<id>` ANTES de cualquier navigate.
    const deepLinkProductId = new URL(window.location.href).searchParams.get(
      'product'
    );
    // Snapshot del `?category=<id>` (link compartido desde el admin) ANTES de
    // cualquier navigate.
    const deepLinkCategoryId = new URL(window.location.href).searchParams.get(
      'category'
    );

    // Pre-seleccionamos la categoría ANTES de cargar el catálogo. Así, cuando
    // el category-filter (p-tabs) renderice por primera vez, ya arranca con el
    // tab correcto seleccionado. Si lo hiciéramos después del primer render,
    // PrimeNG p-tabs reacciona al cambio de `value` post-init emitiendo un
    // valueChange que termina reseteando la selección a "Ver todos".
    if (deepLinkCategoryId) {
      this.ecommerceStore.setSelectedCategory(deepLinkCategoryId);
    }

    const slug = getTenantSlugFromUrl();
    if (slug) {
      const result = await this.ecommerceStore.loadCatalog(slug);

      // Plan status comes from the same RPC — no extra query needed
      if (result && 'planExpired' in result) {
        this.planStore.setPlanPublicStatus(result.planExpired, result.isFreePlan);

        if (!result.isFreePlan && !result.planExpired) {
          this.posthogService.enablePublicTracking(slug);
        }
      }
    }

    // Deep-link de categoría: la categoría ya quedó pre-seleccionada arriba; el
    // catálogo cargó TODOS los productos, así que recargamos filtrando por la
    // categoría y limpiamos el query param.
    if (deepLinkCategoryId && slug) {
      await this.ecommerceStore.loadProducts(slug);
      this.router.navigate([], {
        queryParams: { category: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    // Una vez resuelto el tenant (catalogInfo poblado), abrimos el modal
    // del producto deep-linkeado. Lo hacemos acá y NO en el child Catalog
    // porque el child se monta antes de que loadCatalog termine — y
    // dialogService.open() pierde el host de PrimeNG si lo llamamos muy
    // temprano.
    if (deepLinkProductId) {
      this.openDeepLinkProduct(deepLinkProductId);
    }

    window.addEventListener('message', this.handlePreviewMessage);
  }

  private async openDeepLinkProduct(productId: string): Promise<void> {
    const result = await this.ecommerceService.getProductById(productId);
    if (result.isLeft()) {
      console.warn('[deep-link] producto no encontrado', productId, result.value);
      return;
    }
    result.mapRight((product) => {
      this.dialogService.open(
        ProductDetailModal,
        dialogConfig({
          data: { product },
          showHeader: false,
          style: { width: '56rem', maxWidth: '95vw' },
          contentStyle: { padding: '0', overflow: 'hidden' },
        })
      );
      // Limpia el query param sin recargar — back/forward no reabre y el
      // link sigue compartible vía el botón Compartir.
      this.router.navigate([], {
        queryParams: { product: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.handlePreviewMessage);
    if (this.ecommerceStore.isPreviewMode()) {
      this.ecommerceStore.exitPreviewMode();
    }
    this.removeThemePalette();
  }

  private removeThemePalette(): void {
    const el = document.documentElement;
    for (const suffix of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      el.style.removeProperty(`--color-primary-${suffix}`);
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
    el.style.setProperty('--color-primary-200', tint(0.7));
    el.style.setProperty('--color-primary-300', tint(0.5));
    el.style.setProperty('--color-primary-400', tint(0.25));
    el.style.setProperty('--color-primary-500', baseColor);
    el.style.setProperty('--color-primary-600', shade(0.15));
    el.style.setProperty('--color-primary-700', shade(0.3));
    el.style.setProperty('--color-primary-800', shade(0.5));
    el.style.setProperty('--color-primary-900', shade(0.65));
  }

  private hexToRgb(hex: string): [number, number, number] | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
      ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
      : null;
  }

  private mixWithWhite(
    [r, g, b]: [number, number, number],
    amount: number
  ): string {
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    return `#${[mix(r), mix(g), mix(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  private mixWithBlack(
    [r, g, b]: [number, number, number],
    amount: number
  ): string {
    const mix = (c: number) => Math.round(c * (1 - amount));
    return `#${[mix(r), mix(g), mix(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')}`;
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
    let link: HTMLLinkElement | null = head.querySelector(
      'link[rel="canonical"]'
    );
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private updateJsonLd(data: Record<string, unknown>): void {
    const head = this.document.head;
    let script: HTMLScriptElement | null = head.querySelector(
      'script[type="application/ld+json"]'
    );
    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}

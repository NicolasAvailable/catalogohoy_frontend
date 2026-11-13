const PREVIEW_CACHE_KEY = 'ch-preview-overrides';
import { CatalogLook, buildLookCss, hasLook, lookFontHref, onPrimaryColor, safeUrl } from '../../domain/catalog-look';
import { CatalogLookState } from '../../domain/catalog-look.state';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { StripHtmlPipe } from '@shared/presenter';
import {
  AppLanguage,
  LanguageService,
  MetaPixelService,
  PosthogService,
} from '@catalogohoy/core';
import { PlanStore } from '@catalogohoy/plan';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { DialogService, IconComponent, dialogConfig } from '@ui';
import {
  CartStore,
  CatalogConfigLiveService,
  EcommerceService,
  EcommerceStore,
} from '../../infrastructure';
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
    TranslocoPipe,
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
  private readonly metaPixel = inject(MetaPixelService);
  private readonly configLive = inject(CatalogConfigLiveService);
  private readonly language = inject(LanguageService);

  /** Idioma default del tenant: se aplica UNA vez al cargar el catálogo y
   *  solo si el visitante no eligió idioma con el switcher (localStorage).
   *  setSession no persiste, así que la elección explícita siempre manda. */
  private tenantLanguageApplied = false;
  private readonly applyTenantLanguage = effect(() => {
    const info = this.ecommerceStore.effectiveCatalogInfo();
    if (!info) return;
    // En modo preview (iframe del editor) el idioma refleja EN VIVO el draft
    // del tenant, ignorando la preferencia local del admin: el comerciante
    // está viendo lo que verá un visitante nuevo.
    if (this.ecommerceStore.isPreviewMode()) {
      this.language.setSession(info.defaultLanguage as AppLanguage);
      return;
    }
    if (this.tenantLanguageApplied) return;
    this.tenantLanguageApplied = true;
    // Prioridad del visitante: su elección en el catálogo > default del
    // tenant. La preferencia del PANEL (otra llave) no aplica acá.
    const stored = this.language.getStoredCatalogLanguage();
    this.language.setSession(stored ?? (info.defaultLanguage as AppLanguage));
  });

  /** El pixel del tenant se inicializa cuando (a) el gate de plan pago pasó
   *  (`pixelGateOk`, seteado en ngOnInit con el resultado del RPC) Y (b)
   *  catalogInfo() ya está poblado con el metaPixelId. Un effect (no un read
   *  one-shot) para que no importe el orden en que se resuelven ambos: evita la
   *  race donde el signal aún no reflejaba el pixel justo tras el await. No corre
   *  en el preview del editor. */
  public readonly pixelGateOk = signal(false);
  private tenantPixelInited = false;
  private readonly initTenantPixelEffect = effect(() => {
    const info = this.ecommerceStore.effectiveCatalogInfo();
    const gateOk = this.pixelGateOk();
    if (this.tenantPixelInited || !gateOk || !info?.metaPixelId) return;
    if (this.ecommerceStore.isPreviewMode()) return;
    this.tenantPixelInited = true;
    this.metaPixel.initTenantPixel(info.metaPixelId);
  });
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
    // La descripción viene del editor rich-text como HTML; sin limpiar, el
    // Web Share API pega los <p> literales en WhatsApp/Telegram (Android).
    const shareData = {
      title: info?.name ?? 'Catálogo',
      text: new StripHtmlPipe().transform(info?.description),
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
    // El editor vive en el mismo origen (web) o dentro de la app nativa, cuyo
    // WebView usa capacitor://localhost (iOS) o https://localhost (Android).
    const fromNativeApp = event.origin === 'capacitor://localhost' || event.origin === 'https://localhost';
    if (event.origin !== window.location.origin && !fromNativeApp) return;
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
        // Se recuerda para el próximo frame (cambiar Móvil/Escritorio o pasar
        // al checkout recarga el iframe): así arranca ya con el diseño en
        // edición y no parpadea el catálogo sin tema.
        try {
          sessionStorage.setItem(this.previewCacheKey(), JSON.stringify(this.ecommerceStore.previewOverrides()));
        } catch { /* storage lleno o bloqueado: no pasa nada */ }
        break;
    }
  };

  constructor() {
    if (typeof window !== 'undefined' && window.parent !== window) {
      // Vista previa del editor (iframe): sin skeletons. Con los skeletons
      // visibles dentro del iframe, el hilo Compositor de Chrome/Arc 157 se cae
      // (SIGTRAP) ~3 s después de cargar el editor — medido: 5-8 caídas de 12
      // con skeletons, 0 de 12 sin ellos. El catálogo público no se ve afectado.
      if (!document.getElementById('ch-preview-no-skeleton')) {
        const st = document.createElement('style');
        st.id = 'ch-preview-no-skeleton';
        st.textContent = '[class*="skeleton"] { display: none !important; }';
        document.head.appendChild(st);
      }
    }
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

    // Opciones de diseño (CAT-103): una hoja de estilos + a lo sumo 1 fuente.
    // Sin `look` no se inyecta nada (el catálogo queda idéntico a hoy).
    // Antes de que llegue el catálogo se usa el último look conocido (preview
    // en curso o caché de la visita anterior) para que el esqueleto ya salga
    // con los colores del tema.
    this.restoreEarlyLook();
    effect(() => {
      const info = this.ecommerceStore.effectiveCatalogInfo();
      if (!info) {
        if (this.earlyLook) this.applyLook(this.earlyLook.look, this.earlyLook.themeColor);
        return;
      }
      this.applyLook(info.look ?? null, info.themeColor ?? '#10b981');
      if (!this.ecommerceStore.isPreviewMode()) this.cacheLook(info.look ?? null, info.themeColor);
    });
  }

  private readonly lookState = inject(CatalogLookState);
  private earlyLook: { look: CatalogLook | null; themeColor: string } | null = null;

  private restoreEarlyLook(): void {
    try {
      const isPreview = new URL(window.location.href).searchParams.get('preview') === 'true';
      if (isPreview) {
        const raw = sessionStorage.getItem(this.previewCacheKey());
        if (raw) {
          const overrides = JSON.parse(raw);
          this.ecommerceStore.enterPreviewMode();
          this.ecommerceStore.applyPreviewOverrides(overrides);
          if (overrides?.look) {
            this.earlyLook = { look: overrides.look, themeColor: overrides.themeColor ?? '#10b981' };
            if (overrides.themeColor) this.applyThemePalette(overrides.themeColor);
          }
        }
        return;
      }
      const cached = localStorage.getItem(this.lookCacheKey());
      if (cached) {
        this.earlyLook = JSON.parse(cached);
        if (this.earlyLook?.themeColor) this.applyThemePalette(this.earlyLook.themeColor);
      }
    } catch { /* sin storage: arranca como siempre */ }
  }

  /** Caché del preview por catálogo: si cambias de tienda en el admin no se
   *  arrastran el nombre/logo/colores de la anterior. */
  private previewCacheKey(): string {
    const slug = new URL(window.location.href).searchParams.get('slug') ?? '';
    return `${PREVIEW_CACHE_KEY}-${slug}`;
  }

  private lookCacheKey(): string {
    const slug = new URL(window.location.href).searchParams.get('slug') ?? '';
    return `ch-look-${window.location.hostname}${slug ? '-' + slug : ''}`;
  }

  private cacheLook(look: CatalogLook | null, themeColor: string): void {
    try {
      if (hasLook(look)) localStorage.setItem(this.lookCacheKey(), JSON.stringify({ look, themeColor }));
      else localStorage.removeItem(this.lookCacheKey());
    } catch { /* noop */ }
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

      // Config en vivo: si el comerciante guarda cambios en Editar catálogo
      // (p. ej. agrega su vendedor de WhatsApp) mientras un visitante está en
      // el checkout, la config se refresca sola y el botón de pedido se
      // activa sin recargar.
      const tenantId = this.ecommerceStore.catalogInfo()?.id;
      if (tenantId && !this.ecommerceStore.isPreviewMode()) {
        this.configLive.watch(slug, tenantId);
      }

      // Plan status comes from the same RPC — no extra query needed
      if (result && 'planExpired' in result) {
        this.planStore.setPlanPublicStatus(result.planExpired, result.isFreePlan);

        if (!result.isFreePlan && !result.planExpired) {
          this.posthogService.enablePublicTracking(slug);
          // Pixel de Meta del comerciante (solo planes pagos, no vencidos): el
          // init lo dispara `initTenantPixelEffect` cuando catalogInfo() ya
          // reflejó el pixel del RPC. Leerlo acá mismo era una race: el signal a
          // veces todavía no estaba poblado justo tras el await → initTenantPixel
          // recibía null y no hacía nada (~5 de 6 cargas). Con el effect es
          // determinístico. Los eventos de compra (ViewContent/AddToCart/
          // InitiateCheckout/Lead) salen de las vistas con trackActiveTenant.
          this.pixelGateOk.set(true);
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
    // Dentro del editor (iframe): avisa que ya escucha, para que el editor
    // reenvíe el diseño actual. Sin esto, si el frame tarda en arrancar se
    // pierden los mensajes y queda el diseño viejo de la sesión.
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ source: 'catalogohoy-storefront', type: 'PREVIEW_READY' }, '*');
      } catch { /* sin acceso al padre */ }
    }
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
    this.configLive.unwatch();
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

  private applyLook(look: CatalogLook | null, themeColor: string): void {
    // Texto del botón de agregar: no es CSS, lo leen las tarjetas de producto.
    this.lookState.buttonText.set((look?.buttonText ?? '').trim().slice(0, 24));
    const STYLE_ID = 'ch-catalog-look';
    const FONT_ID = 'ch-catalog-look-font';
    const doc = document;
    let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    this.applyBgVideo(look);
    if (!hasLook(look)) {
      style?.remove();
      doc.getElementById(FONT_ID)?.remove();
      return;
    }
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      doc.head.appendChild(style);
    }
    style.textContent =
      `:root, .ecommerce { --lk-on-primary: ${onPrimaryColor(themeColor)}; }\n` + buildLookCss(look, themeColor);

    const href = lookFontHref(look);
    let link = doc.getElementById(FONT_ID) as HTMLLinkElement | null;
    if (!href) {
      link?.remove();
    } else if (link?.href !== href) {
      if (!link) {
        link = doc.createElement('link');
        link.id = FONT_ID;
        link.rel = 'stylesheet';
        doc.head.appendChild(link);
      }
      link.href = href;
    }
  }

  /** Fondo de video: <video> fijo detrás del contenido (muted+loop+inline
   *  para que arranque solo en iOS/Android). Se quita si el look no lo usa. */
  private applyBgVideo(look: CatalogLook | null): void {
    const VIDEO_ID = 'ch-catalog-bg-video';
    const doc = document;
    const url = look?.bgType === 'video' ? safeUrl(look.bgVideo) : '';
    let video = doc.getElementById(VIDEO_ID) as HTMLVideoElement | null;
    if (!url) {
      video?.remove();
      return;
    }
    if (!video) {
      video = doc.createElement('video');
      video.id = VIDEO_ID;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none;';
      doc.body.prepend(video);
    }
    const dim = Math.min(70, Math.max(0, look?.bgDim ?? 25)) / 100;
    video.style.filter = `brightness(${1 - dim})`;
    if (video.getAttribute('src') !== url) {
      video.src = url;
      void video.play().catch(() => undefined);
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
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(0, 0, size, size, radius);
      } else {
        // Fallback for Safari < 16 (iOS 15) which lacks CanvasRenderingContext2D.roundRect
        const r = Math.min(radius, size / 2);
        ctx.moveTo(r, 0);
        ctx.arcTo(size, 0, size, size, r);
        ctx.arcTo(size, size, 0, size, r);
        ctx.arcTo(0, size, 0, 0, r);
        ctx.arcTo(0, 0, size, 0, r);
      }
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

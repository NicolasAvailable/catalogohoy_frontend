import { inject, Injectable, isDevMode, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from '@catalogohoy/env';
import { filter } from 'rxjs';

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class MetaPixelService {
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);

  /** fbevents.js (stub + script) cargado una sola vez. */
  private scriptLoaded = false;
  /** Pixels ya inicializados con fbq('init'), para no repetir el init. */
  private readonly initedPixels = new Set<string>();
  /** Pixel del catálogo actualmente cargado (storefront). Las vistas disparan
   *  sus eventos con {@link trackActiveTenant} sin tener que conocer el ID. */
  private activeTenantPixelId: string | null = null;

  /** Pixel propio de CatalogoHoy (funnel de la plataforma: signup, planes…). */
  private get globalPixelId(): string | undefined {
    return environment.metaPixelId;
  }

  /** El tracking está activo solo fuera de dev: en local no disparamos eventos
   *  reales a Meta. Aplica tanto al pixel propio como a los de los catálogos. */
  private get enabled(): boolean {
    return !isDevMode();
  }

  constructor() {
    if (!this.enabled || !this.globalPixelId) return;

    this.ngZone.runOutsideAngular(() => {
      this.ensureScript();
      this.initPixel(this.globalPixelId!);
      // Todo se dispara con trackSingle (aislado por pixel): así el pixel propio
      // no recibe los eventos de los catálogos ni al revés cuando ambos están
      // inicializados en la misma página (el storefront).
      this.trackSingle(this.globalPixelId!, 'PageView');
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => this.trackSingle(this.globalPixelId!, 'PageView'));
    });
  }

  /** Inyecta el stub de fbq + fbevents.js. Idempotente. */
  private ensureScript(): void {
    if (this.scriptLoaded) return;

    /* eslint-disable */
    const f: any = window;
    const n = (f.fbq = function (...args: unknown[]) {
      (n as any).callMethod
        ? (n as any).callMethod.apply(n, args)
        : (n as any).queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    (n as any).push = n;
    (n as any).loaded = true;
    (n as any).version = '2.0';
    (n as any).queue = [];
    /* eslint-enable */

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);

    this.scriptLoaded = true;
  }

  private initPixel(pixelId: string): void {
    if (this.initedPixels.has(pixelId)) return;
    window.fbq('init', pixelId);
    this.initedPixels.add(pixelId);
  }

  /** Dispara un evento SOLO al pixel indicado (no a todos los inicializados).
   *  `eventID` permite deduplicar contra el mismo evento enviado por la
   *  Conversions API (server-side) — Meta cuenta una sola conversión. */
  private trackSingle(
    pixelId: string,
    event: string,
    params?: Record<string, unknown>,
    eventID?: string
  ): void {
    if (eventID) {
      window.fbq('trackSingle', pixelId, event, params, { eventID });
    } else {
      window.fbq('trackSingle', pixelId, event, params);
    }
  }

  // ─────────────── Pixel propio de CatalogoHoy ───────────────
  trackEvent(event: string, params?: Record<string, unknown>): void {
    if (!this.enabled || !this.globalPixelId) return;
    if (!this.initedPixels.has(this.globalPixelId)) return;
    this.ngZone.runOutsideAngular(() =>
      this.trackSingle(this.globalPixelId!, event, params)
    );
  }

  trackCustomEvent(event: string, params?: Record<string, unknown>): void {
    if (!this.enabled || !this.globalPixelId) return;
    if (!this.initedPixels.has(this.globalPixelId)) return;
    this.ngZone.runOutsideAngular(() =>
      window.fbq('trackSingleCustom', this.globalPixelId, event, params)
    );
  }

  // ─────────────── Pixel del catálogo (per-tenant) ───────────────
  /** Inicializa el pixel del catálogo público y dispara su PageView, y lo deja
   *  como pixel activo para {@link trackActiveTenant}. Idempotente y aislado
   *  del pixel propio. No hace nada en dev ni si el pixelId es vacío. */
  initTenantPixel(pixelId: string | null | undefined): void {
    if (!this.enabled || !pixelId) return;
    this.activeTenantPixelId = pixelId;
    this.ngZone.runOutsideAngular(() => {
      this.ensureScript();
      const isNew = !this.initedPixels.has(pixelId);
      this.initPixel(pixelId);
      if (isNew) this.trackSingle(pixelId, 'PageView');
    });
  }

  /** Dispara un evento SOLO al pixel del catálogo activo (el del storefront
   *  cargado). No-op si no hay pixel activo (catálogo sin pixel, dev, o plan no
   *  pago porque {@link initTenantPixel} nunca se llamó). `eventID` deduplica
   *  contra el evento equivalente de la Conversions API. */
  trackActiveTenant(
    event: string,
    params?: Record<string, unknown>,
    eventID?: string
  ): void {
    const pixelId = this.activeTenantPixelId;
    if (!this.enabled || !pixelId || !this.initedPixels.has(pixelId)) return;
    this.ngZone.runOutsideAngular(() =>
      this.trackSingle(pixelId, event, params, eventID)
    );
  }
}

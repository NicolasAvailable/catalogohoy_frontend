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
  private initialized = false;

  private get isConfigured(): boolean {
    if (isDevMode()) return false;
    return !!environment.metaPixelId;
  }

  constructor() {
    if (!this.isConfigured) return;

    this.ngZone.runOutsideAngular(() => {
      this.loadPixelScript();
      this.initRouterTracking();
    });
  }

  private loadPixelScript(): void {
    if (this.initialized) return;

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

    window.fbq('init', environment.metaPixelId);
    window.fbq('track', 'PageView');

    this.initialized = true;
  }

  private initRouterTracking(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        window.fbq('track', 'PageView');
      });
  }

  trackEvent(event: string, params?: Record<string, unknown>): void {
    if (!this.isConfigured || !this.initialized) return;
    this.ngZone.runOutsideAngular(() => {
      window.fbq('track', event, params);
    });
  }

  trackCustomEvent(event: string, params?: Record<string, unknown>): void {
    if (!this.isConfigured || !this.initialized) return;
    this.ngZone.runOutsideAngular(() => {
      window.fbq('trackCustom', event, params);
    });
  }
}

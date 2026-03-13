import { inject, Injectable, isDevMode, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from '@catalogohoy/env';
import { PlanStore } from '@catalogohoy/plan';
import posthog from 'posthog-js';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PosthogService {
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly planStore = inject(PlanStore);

  private get isConfigured(): boolean {
    if (isDevMode()) return false;
    return (
      !!environment.posthogKey &&
      environment.posthogKey !== 'YOUR_POSTHOG_API_KEY'
    );
  }

  constructor() {
    if (!this.isConfigured) return;

    // Fuera de la zona Angular para no afectar el change detection,
    // especialmente crítico durante session recording
    this.ngZone.runOutsideAngular(() => {
      posthog.init(environment.posthogKey, {
        api_host: environment.posthogHost,
        defaults: '2026-01-30', // auto-pageview en SPA + mejores defaults
        session_recording: {
          maskAllInputs: true,
          maskInputOptions: { password: true, email: true },
          blockSelector: '[data-ph-no-capture]',
        },
        disable_session_recording: true, // solo activa en /admin
        persistence: 'localStorage',
        autocapture: false,
      });
    });

    this.initRouterTracking();
  }

  private initRouterTracking(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const event = e as NavigationEnd;
        const isAdmin = event.urlAfterRedirects.startsWith('/admin');

        if (isAdmin) {
          this.ngZone.runOutsideAngular(() => posthog.startSessionRecording());
        } else {
          this.ngZone.runOutsideAngular(() => posthog.stopSessionRecording());
          const slug = localStorage.getItem('slug');
          if (slug) posthog.register({ tenant_slug: slug });
        }
      });
  }

  identify(userId: string, properties?: Record<string, unknown>): void {
    if (!this.isConfigured) return;
    posthog.identify(userId, properties);
  }

  reset(): void {
    if (!this.isConfigured) return;
    posthog.reset();
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.isConfigured) return;
    if (this.planStore.currentPlan()?.isFree) return;
    posthog.capture(event, properties);
  }
}

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
  private publicTrackingEnabled = false;

  private get isConfigured(): boolean {
    if (isDevMode()) return false;
    return (
      !!environment.posthogKey &&
      environment.posthogKey !== 'YOUR_POSTHOG_API_KEY'
    );
  }

  constructor() {
    if (!this.isConfigured) return;

    this.ngZone.runOutsideAngular(() => {
      posthog.init(environment.posthogKey, {
        api_host: environment.posthogHost,
        defaults: '2026-01-30',
        capture_pageview: false, // Control manual: solo planes pagados y vigentes
        session_recording: {
          maskAllInputs: false,
          maskInputOptions: { password: true, email: false },
          blockSelector: '[data-ph-no-capture]',
        },
        disable_session_recording: true,
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
          this.ngZone.runOutsideAngular(() => {
            posthog.startSessionRecording();
            posthog.capture('$pageview');
          });
        } else {
          this.ngZone.runOutsideAngular(() => posthog.stopSessionRecording());
          if (this.publicTrackingEnabled) {
            this.ngZone.runOutsideAngular(() => posthog.capture('$pageview'));
          }
        }
      });
  }

  /** Activa captura de eventos para un catálogo público con plan pagado y vigente */
  enablePublicTracking(slug: string): void {
    if (!this.isConfigured) return;
    this.publicTrackingEnabled = true;
    this.ngZone.runOutsideAngular(() => {
      posthog.register({ tenant_slug: slug });
      posthog.capture('$pageview');
    });
  }

  identify(userId: string, properties?: Record<string, unknown>): void {
    if (!this.isConfigured) return;
    posthog.identify(userId, properties);
  }

  reset(): void {
    if (!this.isConfigured) return;
    posthog.reset();
    this.publicTrackingEnabled = false;
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.isConfigured) return;
    if (this.planStore.currentPlan()?.isFree) return;
    posthog.capture(event, properties);
  }
}

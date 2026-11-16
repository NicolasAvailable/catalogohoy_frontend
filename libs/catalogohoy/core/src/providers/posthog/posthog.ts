import { inject, Injectable, isDevMode, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from '@catalogohoy/env';
import { PlanStore } from '@catalogohoy/plan';
import posthog, { CaptureResult } from 'posthog-js';
import {
  isNoiseError,
  registerErrorSink,
} from '../error-reporter/error-reporter';
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
        // Error Tracking: errores no capturados y promesas rechazadas que
        // llegan a window (los de Angular entran por el ErrorHandler, abajo).
        // console.error NO: hay mucho log benigno de librerías.
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false,
        },
        // Mismo filtro de ruido que Slack #errors y Sentry.
        before_send: (event) => (isNoiseException(event) ? null : event),
      });
    });

    // Errores que Angular atrapa en su ErrorHandler global (la mayoría de los
    // de la app) → PostHog. Se registra solo si PostHog está activo.
    registerErrorSink((error) =>
      this.ngZone.runOutsideAngular(() => posthog.captureException(error))
    );

    this.initRouterTracking();
  }

  private initRouterTracking(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const event = e as NavigationEnd;
        // Backoffice autenticado: admin + Punto de Venta (/pos vive top-level,
        // fuera de /admin) + el wizard de onboarding (/onboarding, el embudo de
        // activación — queremos ver dónde se traban los nuevos). Todos se graban
        // (session recording) y capturan pageview; el resto (storefront público)
        // no, salvo tracking público.
        const url = event.urlAfterRedirects;
        const isBackoffice =
          url.startsWith('/admin') ||
          url.startsWith('/pos') ||
          url.startsWith('/onboarding');

        if (isBackoffice) {
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

  /** Eventos del embudo de onboarding: se capturan SIEMPRE, sin el gate de
   *  plan pagado de `capture()` — los usuarios que hacen el onboarding están
   *  en plan gratis por definición, y ese es justo el funnel de activación que
   *  queremos medir (dónde se cae la gente en el wizard). */
  captureOnboarding(event: string, properties?: Record<string, unknown>): void {
    if (!this.isConfigured) return;
    this.ngZone.runOutsideAngular(() => posthog.capture(event, properties));
  }
}

/** Errores de chunk lazy tras un deploy: se auto-recuperan recargando. */
const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|Expected a JavaScript module script|ChunkLoadError|Loading chunk [\w-]+ failed/i;

/** `before_send`: descarta excepciones que son ruido (navegadores in-app,
 *  extensiones, WebView nativo, chunks viejos). El resto de eventos pasa. */
function isNoiseException(event: CaptureResult | null): boolean {
  if (!event || event.event !== '$exception') return false;
  const list = (event.properties?.['$exception_list'] ?? []) as {
    type?: string;
    value?: string;
  }[];
  const text = [
    event.properties?.['$exception_message'],
    ...list.map((e) => `${e.type ?? ''}: ${e.value ?? ''}`),
  ]
    .filter(Boolean)
    .join(' | ');
  return isNoiseError(text) || CHUNK_LOAD_ERROR.test(text);
}

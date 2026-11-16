import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { environment } from '@catalogohoy/env';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExpirationBannerComponent, PlanStore } from '@catalogohoy/plan';
import { ImportExportHubComponent, ImportHubLauncher } from '@catalogohoy/product';
// Banner de "Siguiente paso" (activación, CAT-73) bajado temporalmente mientras
// se rediseña. Reactivar restaurando este import, la entrada en `imports` y la
// línea en base.html.
// import { ActivationBanner } from '@catalogohoy/home';
import { WhatsappSupportComponent } from '@ui';
import { AiAnnouncement, Navbar, Sidebar, UpdateBanner } from '../../components';

@Component({
  selector: 'app-base',
  imports: [
    RouterOutlet,
    Navbar,
    Sidebar,
    WhatsappSupportComponent,
    ExpirationBannerComponent,
    // ActivationBanner, // bajado temporalmente (ver nota arriba)
    AiAnnouncement,
    UpdateBanner,
    TranslocoPipe,
    ImportExportHubComponent,
  ],
  templateUrl: './base.html',
  // El editor de catálogo (pantalla completa) no tiene navbar; su botón ☰ en
  // teléfono pide abrir este mismo menú con un evento de window.
  host: { '(window:ch-toggle-sidebar)': 'toggleSidebar()' },
})
export class Base implements OnInit {
  private readonly planStore = inject(PlanStore);
  /** El hub de importar productos vive acá (no en Productos) para que un
   *  import siga corriendo en segundo plano mientras se navega por la app. */
  public readonly importHub = inject(ImportHubLauncher);

  private readonly router = inject(Router);

  /** Rutas que se muestran a pantalla completa, sin sidebar ni navbar del
   *  admin (p.ej. el editor de diseño del catálogo, CAT-103). */
  private static readonly FULLSCREEN_PREFIXES = ['/admin/catalog/edit'];
  public readonly isFullscreen = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
      map((url) => Base.FULLSCREEN_PREFIXES.some((p) => url.startsWith(p)))
    ),
    { initialValue: false }
  );

  private readonly destroyRef = inject(DestroyRef);

  public readonly sidebarOpen = signal(false);
  /** Esqueleto del Asistente WhatsApp mientras se descarga esa vista (ruta lazy).
   *  Solo para /admin/whatsapp-bot: el resto de vistas tiene su propio layout y
   *  no debe ver este esqueleto. Solo aparece si la navegación tarda. */
  public readonly navigating = signal(false);
  private navTimer: ReturnType<typeof setTimeout> | null = null;
  public readonly helpGuideUrl = environment.helpGuideUrl;

  ngOnInit() {
    this.planStore.loadTenantPlanUsage();
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      if (e instanceof NavigationStart) {
        if (this.navTimer) clearTimeout(this.navTimer);
        this.navTimer = null;
        this.navigating.set(false);
        if (!e.url.startsWith('/admin/whatsapp-bot')) return;
        this.navTimer = setTimeout(() => this.navigating.set(true), 120);
      } else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        if (this.navTimer) clearTimeout(this.navTimer);
        this.navTimer = null;
        this.navigating.set(false);
      }
    });
  }

  public toggleSidebar() {
    this.sidebarOpen.update((v: boolean) => !v);
  }
}

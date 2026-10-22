import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { environment } from '@catalogohoy/env';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExpirationBannerComponent, PlanStore } from '@catalogohoy/plan';
// Banner de "Siguiente paso" (activación, CAT-73) bajado temporalmente mientras
// se rediseña. Reactivar restaurando este import, la entrada en `imports` y la
// línea en base.html.
// import { ActivationBanner } from '@catalogohoy/home';
import { WhatsappSupportComponent } from '@ui';
import {
  AiAnnouncement,
  MobileMoreDrawer,
  MobileTabBar,
  Navbar,
  Sidebar,
  UpdateBanner,
} from '../../components';

@Component({
  selector: 'app-base',
  imports: [
    RouterOutlet,
    Navbar,
    Sidebar,
    MobileTabBar,
    MobileMoreDrawer,
    WhatsappSupportComponent,
    ExpirationBannerComponent,
    // ActivationBanner, // bajado temporalmente (ver nota arriba)
    AiAnnouncement,
    UpdateBanner,
    TranslocoPipe,
  ],
  templateUrl: './base.html',
})
export class Base implements OnInit {
  private readonly planStore = inject(PlanStore);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  public readonly sidebarOpen = signal(false);
  /** Drawer "Más" de la app nativa (entra desde la derecha). */
  public readonly moreOpen = signal(false);
  /** Esqueleto mientras se descarga la vista nueva (rutas lazy). Solo aparece
   *  si la navegación tarda, para no parpadear en las rápidas. */
  public readonly navigating = signal(false);
  private navTimer: ReturnType<typeof setTimeout> | null = null;
  public readonly helpGuideUrl = environment.helpGuideUrl;

  ngOnInit() {
    this.planStore.loadTenantPlanUsage();
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      if (e instanceof NavigationStart) {
        if (this.navTimer) clearTimeout(this.navTimer);
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

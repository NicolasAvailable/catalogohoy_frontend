import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  public readonly sidebarOpen = signal(false);
  /** Drawer "Más" de la app nativa (entra desde la derecha). */
  public readonly moreOpen = signal(false);
  public readonly helpGuideUrl = environment.helpGuideUrl;

  ngOnInit() {
    this.planStore.loadTenantPlanUsage();
  }

  public toggleSidebar() {
    this.sidebarOpen.update((v: boolean) => !v);
  }
}

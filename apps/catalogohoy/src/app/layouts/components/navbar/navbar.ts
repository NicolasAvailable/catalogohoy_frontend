import { Clipboard } from '@angular/cdk/clipboard';
import { Component, computed, inject, OnInit, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageSelectorComponent } from '@catalogohoy/core';
import { environment } from '@catalogohoy/env';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlanStore } from '@catalogohoy/plan';
import { CreditsWidgetComponent } from '@catalogohoy/product';
import { ProfileStore } from '@catalogohoy/profile';
import { TenantStore, getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { is, qr } from '@shared/domain';
import { BaseComponent } from '@shared/presenter';
import {
  AvatarComponent,
  ButtonComponent,
  IconComponent,
  TooltipDirective,
} from '@ui';
import { ProfileMenu } from './components';

@Component({
  selector: 'app-navbar',
  imports: [
    AvatarComponent,
    ButtonComponent,
    CreditsWidgetComponent,
    IconComponent,
    LanguageSelectorComponent,
    TooltipDirective,
    TranslocoPipe,
    ProfileMenu,
    RouterLink,
  ],
  templateUrl: './navbar.html',
})
export class Navbar extends BaseComponent implements OnInit {
  public toggleSidebar = output<void>();
  private readonly clipboard = inject(Clipboard);
  public readonly profileStore = inject(ProfileStore);
  public readonly planStore = inject(PlanStore);
  private readonly tenantStore = inject(TenantStore);

  /** Catálogo ACTIVO (por slug del subdominio), no el primero de la lista:
   *  un owner con varios catálogos debe compartir/QR el que está administrando.
   *  Mismo patrón que el sidebar (currentTenant). */
  private readonly currentTenant = computed(() => {
    const slug = getTenantSlugFromUrl() || this.tenantStore.tenantSlug() || '';
    const tenants = this.profileStore.profile().tenantList.tenants;
    return tenants.find((t) => t.slug === slug) ?? this.profileStore.profile().tenantList.first;
  });

  public readonly currentPlanPalette = this.planStore.currentPlanPalette;
  public readonly helpGuideUrl = environment.helpGuideUrl;

  /** Open the public help center (guide) in a new tab. */
  public openGuide(): void {
    window.open(this.helpGuideUrl, '_blank', 'noopener');
  }

  ngOnInit(): void {
    this.planStore.loadTenantPlanUsage();
  }

  public share() {
    const url = this.currentTenant().url;
    is.affirmative(this.clipboard.copy(url)).mapRight(() =>
      this.useCaseProgress
        .completeFor('Se ha copiado al portapapeles')
        .complete()
    );
  }

  public async generateQR() {
    const tenant = this.currentTenant();

    await qr.to.pdf(tenant.url, `QR-${tenant.slug}`, tenant.name);

    this.useCaseProgress.completeFor('QR generado con éxito').complete();
  }
}

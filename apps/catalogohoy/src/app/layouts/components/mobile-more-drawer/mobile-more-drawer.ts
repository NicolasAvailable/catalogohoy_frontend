import { Component, computed, effect, inject, input, output } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthenticationService } from '@catalogohoy/auth';
import { isNativeApp, LanguageSelectorComponent, PosthogService } from '@catalogohoy/core';
import { environment } from '@catalogohoy/env';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { ProfileStore } from '@catalogohoy/profile';
import { TenantStore, getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { ConfirmDialogService, IconComponent } from '@ui';

/**
 * Drawer "Más" de la app nativa: slide-over que entra DESDE LA DERECHA con las
 * secciones que NO están en la barra inferior (Analíticas, Reportes, Tasas del
 * día, Equipo, Referidos, Mi catálogo) + idioma, ayuda y cerrar sesión.
 * SOLO nativo ({@link isNativeApp}); en web no renderiza nada.
 */
@Component({
  selector: 'app-mobile-more-drawer',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    IconComponent,
    LanguageSelectorComponent,
  ],
  templateUrl: './mobile-more-drawer.html',
})
export class MobileMoreDrawer {
  public readonly open = input<boolean>(false);
  public readonly close = output<void>();

  public readonly isNative = isNativeApp();
  public readonly helpGuideUrl = environment.helpGuideUrl;

  private readonly router = inject(Router);
  private readonly auth = inject(AuthenticationService);
  private readonly posthog = inject(PosthogService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly permissions = inject(TeamPermissionsStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly profileStore = inject(ProfileStore);

  public readonly isVenezuela = computed(() => this.tenantCurrency.isVenezuela());

  public readonly canViewAnalytics = computed(
    () => this.permissions.isOwner() || this.permissions.can()('analiticas', 'view')
  );
  public readonly canViewReports = computed(
    () => this.permissions.isOwner() || this.permissions.can()('reportes', 'view')
  );
  public readonly canViewRates = computed(
    () => this.permissions.isOwner() || this.permissions.can()('tasas', 'edit')
  );
  public readonly canViewTeam = computed(
    () => this.permissions.isOwner() || this.permissions.can()('equipo', 'view')
  );
  public readonly canViewCatalog = computed(
    () => this.permissions.isOwner() || this.permissions.can()('catalogo', 'edit')
  );

  private readonly currentTenant = computed(() => {
    const slug = getTenantSlugFromUrl() || this.tenantStore.tenantSlug() || '';
    const tenants = this.profileStore.profile().tenantList.tenants;
    return tenants.find((t) => t.slug === slug) ?? this.profileStore.profile().tenantList.first;
  });

  constructor() {
    // Cerrar el drawer al navegar (mismo patrón que el sidebar).
    effect((onCleanup) => {
      const sub = this.router.events.subscribe((e) => {
        if (e instanceof NavigationEnd && this.open()) this.close.emit();
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** "Ver mi catálogo": abre el storefront público del catálogo activo. */
  public openStorefront(): void {
    const url = this.currentTenant()?.url;
    if (url) window.open(url, '_blank');
    this.close.emit();
  }

  public openGuide(): void {
    window.open(this.helpGuideUrl, '_blank', 'noopener');
    this.close.emit();
  }

  public logout(): void {
    this.close.emit();
    this.confirm
      .warning({
        headerLabel: '¿Cerrar sesión?',
        contentLabel: '¿Estás seguro que deseas cerrar sesión?',
        acceptLabel: 'Cerrar sesión',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        if (result.isRight()) {
          this.posthog.reset();
          this.auth.logout().then(() => {
            window.location.href = 'https://auth.catalogohoy.com';
          });
        }
      });
  }
}

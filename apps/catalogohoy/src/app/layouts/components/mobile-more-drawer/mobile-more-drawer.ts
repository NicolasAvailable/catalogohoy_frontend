import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthenticationService } from '@catalogohoy/auth';
import {
  isNativeApp,
  LanguageSelectorComponent,
  PosthogService,
  setNativeSlug,
} from '@catalogohoy/core';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { ProfileStore } from '@catalogohoy/profile';
import { Tenant, TenantStore, getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { AvatarComponent, ConfirmDialogService, IconComponent } from '@ui';

/**
 * Drawer "Más" de la app nativa: slide-over que entra DESDE LA DERECHA,
 * espejando el sidebar web por secciones (Gestión / Canales de venta) con lo
 * que NO está en la barra inferior, + switcher de catálogo, idioma y cerrar
 * sesión. SOLO nativo ({@link isNativeApp}); en web no renderiza nada.
 */
@Component({
  selector: 'app-mobile-more-drawer',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    IconComponent,
    AvatarComponent,
    LanguageSelectorComponent,
  ],
  templateUrl: './mobile-more-drawer.html',
})
export class MobileMoreDrawer {
  public readonly open = input<boolean>(false);
  public readonly close = output<void>();

  public readonly isNative = isNativeApp();

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

  public readonly currentTenantSlug = computed(
    () => getTenantSlugFromUrl() || this.tenantStore.tenantSlug() || ''
  );
  public readonly allTenants = computed(
    () => this.profileStore.profile().tenantList.tenants
  );
  public readonly showCatalogSwitcher = signal(false);
  /** Submenú "Mi catálogo" (Editar / Ver mi catálogo), como la web.
   *  Arranca ABIERTO por defecto (pedido del user). */
  public readonly showCatalogMenu = signal(true);

  public readonly currentTenant = computed(() => {
    const slug = this.currentTenantSlug();
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

  public toggleCatalogSwitcher(): void {
    this.showCatalogSwitcher.update((v) => !v);
  }

  public toggleCatalogMenu(): void {
    this.showCatalogMenu.update((v) => !v);
  }

  /** Cambiar de catálogo EN NATIVO: NO abrimos el subdominio del tenant (eso
   *  sacaría del shell). Cacheamos el slug y hacemos un hard-reload a /admin
   *  para re-scopear todos los stores al catálogo elegido (mismo criterio que
   *  el post-login nativo). */
  public switchCatalog(tenant: Tenant): void {
    if (tenant.slug === this.currentTenantSlug()) return;
    setNativeSlug(tenant.slug);
    window.location.href = '/admin';
  }

  public createCatalog(): void {
    this.showCatalogSwitcher.set(false);
    this.close.emit();
    this.router.navigate(['/admin/new-catalog']);
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

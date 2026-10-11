import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '@ui';
import { isNativeApp, setNativeSlug } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';

@Component({
  selector: 'lib-no-access-view',
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent, TranslocoPipe],
  templateUrl: './no-access-view.html',
  host: { class: 'flex items-center justify-center p-6 min-h-dvh' },
})
export default class NoAccessViewComponent {
  private readonly tenantStore = inject(TenantStore);

  protected readonly ownTenant = computed(() =>
    this.tenantStore.tenants().find((t) => t.role === 'owner') ?? null
  );

  private readonly router = inject(Router);

  protected goToOwnStore(): void {
    const tenant = this.ownTenant();
    if (!tenant) return;
    if (isNativeApp()) {
      // Nativo: no hay subdominio; cacheamos el slug y entramos in-app.
      setNativeSlug(tenant.slug);
      window.location.href = '/admin';
      return;
    }
    window.location.href = `${tenant.url}/admin`;
  }

  protected createStore(): void {
    if (isNativeApp()) {
      // Nativo: el alta vive en el login in-app (no en la landing web).
      this.router.navigateByUrl('/login');
      return;
    }
    window.location.href = 'https://catalogohoy.com';
  }
}

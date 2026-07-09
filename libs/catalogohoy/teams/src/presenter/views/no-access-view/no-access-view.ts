import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '@ui';
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

  protected goToOwnStore(): void {
    const tenant = this.ownTenant();
    if (tenant) {
      window.location.href = `${tenant.url}/admin`;
    }
  }

  protected createStore(): void {
    window.location.href = 'https://catalogohoy.com';
  }
}

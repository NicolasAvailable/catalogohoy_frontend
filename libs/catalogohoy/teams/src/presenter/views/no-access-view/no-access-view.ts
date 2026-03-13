import { Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '@ui';
import { TenantStore } from '@catalogohoy/tenant';

@Component({
  selector: 'lib-no-access-view',
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './no-access-view.html',
  host: { class: 'flex-1 flex items-center justify-center p-6' },
})
export default class NoAccessViewComponent {
  private readonly tenantStore = inject(TenantStore);

  protected readonly ownTenant = computed(() =>
    this.tenantStore.tenants().find((t) => t.role === 'owner') ?? null
  );

  protected goToOwnStore(): void {
    const tenant = this.ownTenant();
    if (tenant) {
      window.location.href = `https://${tenant.slug}.catalogohoy.com/admin`;
    }
  }

  protected createStore(): void {
    window.location.href = 'https://catalogohoy.com';
  }
}

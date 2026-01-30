import { inject, Injectable } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { BaseSubscriber, SharedSubscriber } from '@shared/infrastructure';

@Injectable({ providedIn: 'root' })
export class AppSubscriber extends BaseSubscriber {
  private readonly sharedSubscriber = inject(SharedSubscriber);
  private readonly tenantStore = inject(TenantStore);

  protected listen(): void {
    this.sharedSubscriber.init();
    // Cargar información del tenant al iniciar la app
    this.tenantStore.loadTenant();
  }
}

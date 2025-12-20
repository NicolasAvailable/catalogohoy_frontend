import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { BaseTenantService } from '../domain';

@Injectable({
  providedIn: 'root',
})
export class TenantService implements BaseTenantService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async isValidSlug(slug: string): Promise<boolean> {
    const { data: tenant } = await this.client.rpc('tenant_exists_by_slug', {
      p_slug: slug,
    });
    return tenant;
  }
}

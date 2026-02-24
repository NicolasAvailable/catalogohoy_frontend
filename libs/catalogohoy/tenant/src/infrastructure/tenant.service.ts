import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { BaseTenantService, CreateCatalogResult } from '../domain';

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

  public async createCatalog(
    name: string,
    slug: string
  ): Promise<E.Either<Error, CreateCatalogResult>> {
    const { data, error } = await this.client.rpc('create_catalog_for_user', {
      p_name: name,
      p_slug: slug,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    const result = data as { id: number; name: string; slug: string };
    return E.right(result);
  }
}

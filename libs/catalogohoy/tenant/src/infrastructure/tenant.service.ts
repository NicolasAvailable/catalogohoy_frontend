import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { BaseTenantService, CreateCatalogResult, SlugCheck } from '../domain';

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

  /**
   * Like isValidSlug but distinguishes "tenant not found" from "the check
   * failed". Retries a few times before giving up so a transient/aborted RPC
   * (e.g. a network blip during bootstrap) doesn't surface as not-found.
   */
  public async checkSlug(slug: string): Promise<SlugCheck> {
    let lastError = 'No se pudo verificar el catálogo';
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await this.client.rpc('tenant_exists_by_slug', {
        p_slug: slug,
      });
      if (!error) {
        return data === true ? { status: 'valid' } : { status: 'not-found' };
      }
      lastError = error.message;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
    return { status: 'error', message: lastError };
  }

  public async getSlugByCustomDomain(domain: string): Promise<string | null> {
    const { data } = await this.client
      .from('tenants')
      .select('slug')
      .eq('custom_domain', domain)
      .single();
    return data?.slug ?? null;
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

  /** Renombra tienda + dirección (onboarding: reemplaza el slug temporal
   *  `tienda-XXXXXX`). Valida disponibilidad con checkSlug solo si el slug
   *  realmente cambia (checkSlug no distingue "existe porque es MI tenant");
   *  el UNIQUE de la DB es la última línea de defensa ante una carrera. */
  public async renameTenant(
    tenantId: number | string,
    name: string,
    slug: string
  ): Promise<E.Either<Error, void>> {
    const slugTaken = () =>
      E.left(
        new Error(
          'Esa dirección de catálogo ya está ocupada. Prueba con otro nombre.'
        )
      );

    const { data: current, error: currentError } = await this.client
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();
    if (currentError) return E.left(new Error(currentError.message));

    if (current?.slug !== slug) {
      const check = await this.checkSlug(slug);
      if (check.status === 'valid') return slugTaken();
      // status 'error' (chequeo transitorio caído): seguimos igual — si el
      // slug estuviera tomado, el update de abajo falla por unique violation.
    }

    const { error } = await this.client
      .from('tenants')
      .update({ name, slug })
      .eq('id', tenantId);

    if (error) {
      const message = error.message ?? '';
      const isUniqueViolation =
        error.code === '23505' ||
        message.includes('duplicate key') ||
        message.toLowerCase().includes('unique');
      return isUniqueViolation ? slugTaken() : E.left(new Error(message));
    }
    return E.right(undefined);
  }
}

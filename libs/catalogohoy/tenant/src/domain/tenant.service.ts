import { E } from '@shared/domain';

export interface CreateCatalogResult {
  id: number;
  name: string;
  slug: string;
}

/**
 * Result of checking a tenant slug. Distinguishes a tenant that genuinely does
 * NOT exist from a transient failure of the check itself — the slug guard must
 * not treat an aborted/failed RPC as "tenant doesn't exist" and bounce the user.
 */
export type SlugCheck =
  | { status: 'valid' }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

export interface BaseTenantService {
  isValidSlug(slug: string): Promise<boolean>;
  checkSlug(slug: string): Promise<SlugCheck>;
  getSlugByCustomDomain(domain: string): Promise<string | null>;
  createCatalog(name: string, slug: string): Promise<E.Either<Error, CreateCatalogResult>>;
  /** Renombra la tienda y su dirección (`tenants.name` + `tenants.slug`).
   *  Left con mensaje amigable si el slug ya está ocupado. */
  renameTenant(
    tenantId: number | string,
    name: string,
    slug: string
  ): Promise<E.Either<Error, void>>;
}

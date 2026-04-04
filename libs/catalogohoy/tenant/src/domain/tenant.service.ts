import { E } from '@shared/domain';

export interface CreateCatalogResult {
  id: number;
  name: string;
  slug: string;
}

export interface BaseTenantService {
  isValidSlug(slug: string): Promise<boolean>;
  getSlugByCustomDomain(domain: string): Promise<string | null>;
  createCatalog(name: string, slug: string): Promise<E.Either<Error, CreateCatalogResult>>;
}

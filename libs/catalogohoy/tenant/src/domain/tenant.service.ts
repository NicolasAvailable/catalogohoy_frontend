import { E } from '@shared/domain';

export interface CreateCatalogResult {
  id: number;
  name: string;
  slug: string;
}

export interface BaseTenantService {
  isValidSlug(slug: string): Promise<boolean>;
  createCatalog(name: string, slug: string): Promise<E.Either<Error, CreateCatalogResult>>;
}

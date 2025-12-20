export interface BaseTenantService {
  isValidSlug(slug: string): Promise<boolean>;
}

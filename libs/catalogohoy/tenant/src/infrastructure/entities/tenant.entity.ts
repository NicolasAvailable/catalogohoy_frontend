import { TenantRol } from '../../domain';

export interface TenantEntity {
  id: number;
  name: string;
  role: TenantRol;
  slug: string;
  is_default: boolean;
  logo?: string | null;
  custom_domain?: string | null;
}

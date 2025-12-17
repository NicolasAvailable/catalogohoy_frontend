import { TenantRol } from '../../domain';

export interface ProfileResponse {
  user: ProfileEntity;
  tenants: TenantEntity[];
  default_tenant: TenantEntity;
}

export interface TenantEntity {
  id: number;
  name: string;
  role: TenantRol;
  slug: string;
  is_default: boolean;
}

export interface ProfileEntity {
  id: number;
  name: string;
  email: string;
  phone: string;
}

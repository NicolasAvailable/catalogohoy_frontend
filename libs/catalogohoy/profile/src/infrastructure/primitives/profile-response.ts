import { TenantEntity } from '@catalogohoy/tenant';

export interface ProfileResponse {
  user: ProfileEntity;
  tenants: TenantEntity[];
  default_tenant: TenantEntity;
}

export interface ProfileEntity {
  id: number;
  name: string;
  email: string;
  phone: string;
  photo: string | null;
  notify_plan_expiry?: boolean;
}

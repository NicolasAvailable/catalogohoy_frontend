export interface PlatformUserTenant {
  id: number;
  name: string | null;
  slug: string | null;
}

export interface PlatformUser {
  id: number;
  name: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  isBanned: boolean;
  lastSignInAt: string | null;
  provider: string | null;
  tenants: PlatformUserTenant[];
}

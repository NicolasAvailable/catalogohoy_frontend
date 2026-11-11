import { PaySource, SignupPlatform } from '../shared/origin/origin.model';

export interface PlatformUserTenant {
  id: number;
  name: string | null;
  slug: string | null;
  plan: string | null;
  paySource: PaySource | null;
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
  signupPlatform: SignupPlatform | null;
  signupSource: string | null;
  signupMedium: string | null;
  signupCampaign: string | null;
  tenants: PlatformUserTenant[];
}

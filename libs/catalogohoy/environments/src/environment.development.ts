import { authenticationEnvironment } from './authentication/environment.development';
import { globalEnvironment } from './global/global.development';
import { posthogEnvironment } from './posthog/posthog';
import { supabaseEnvironment } from './supabase/supabase.development';
import { whatsappEnvironment } from './whatsapp/whatsapp';

export const environment = {
  production: false,
  ...globalEnvironment,
  ...authenticationEnvironment,
  ...supabaseEnvironment,
  ...posthogEnvironment,
  ...whatsappEnvironment,
};

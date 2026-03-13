import { authenticationEnvironment } from './authentication/environment';
import { globalEnvironment } from './global/global.environment';
import { posthogEnvironment } from './posthog/posthog';
import { stripeEnvironment } from './stripe/stripe';
import { supabaseEnvironment } from './supabase/supabase';
import { whatsappEnvironment } from './whatsapp/whatsapp';

export const environment = {
  production: true,
  ...globalEnvironment,
  ...authenticationEnvironment,
  ...supabaseEnvironment,
  ...posthogEnvironment,
  ...stripeEnvironment,
  ...whatsappEnvironment,
};

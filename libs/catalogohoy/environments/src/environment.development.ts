import { authenticationEnvironment } from './authentication/environment.development';
import { globalEnvironment } from './global/global.development';
import { metaPixelEnvironment } from './meta-pixel/meta-pixel';
import { posthogEnvironment } from './posthog/posthog';
import { sentryEnvironment } from './sentry/sentry';
import { supabaseEnvironment } from './supabase/supabase.development';
import { whatsappEnvironment } from './whatsapp/whatsapp';

export const environment = {
  production: false,
  ...globalEnvironment,
  ...authenticationEnvironment,
  ...supabaseEnvironment,
  ...posthogEnvironment,
  ...metaPixelEnvironment,
  ...sentryEnvironment,
  ...whatsappEnvironment,
};

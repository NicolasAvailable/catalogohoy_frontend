import { authenticationEnvironment } from './authentication/environment';
import { globalEnvironment } from './global/global.environment';
import { metaPixelEnvironment } from './meta-pixel/meta-pixel';
import { posthogEnvironment } from './posthog/posthog';
import { sentryEnvironment } from './sentry/sentry';
import { stripeEnvironment } from './stripe/stripe';
import { supabaseEnvironment } from './supabase/supabase';

export const environment = {
  production: true,
  ...globalEnvironment,
  ...authenticationEnvironment,
  ...supabaseEnvironment,
  ...posthogEnvironment,
  ...stripeEnvironment,
  ...metaPixelEnvironment,
  ...sentryEnvironment,
};

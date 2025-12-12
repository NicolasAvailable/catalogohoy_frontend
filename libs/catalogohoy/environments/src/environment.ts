import { authenticationEnvironment } from './authentication/environment';
import { globalEnvironment } from './global/global.environment';
import { supabaseEnvironment } from './supabase/supabase';

export const environment = {
  production: true,
  ...globalEnvironment,
  ...authenticationEnvironment,
  ...supabaseEnvironment,
};

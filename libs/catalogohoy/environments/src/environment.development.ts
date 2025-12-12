import { authenticationEnvironment } from './authentication/environment.development';
import { globalEnvironment } from './global/global.development';
import { supabaseEnvironment } from './supabase/supabase.development';

export const environment = {
  ...globalEnvironment,
  ...authenticationEnvironment,
  ...supabaseEnvironment,
};

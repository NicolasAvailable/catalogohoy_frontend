import { authenticationEnvironment } from './authentication/environment';
import { globalEnvironment } from './global/global.environment';

// Declare process for TypeScript
declare const process: any;

export const environment = {
  production: true,
  ...globalEnvironment,
  ...authenticationEnvironment,
  supabaseUrl: process.env['SUPABASE_URL'],
  supabaseKey: process.env['SUPABASE_ANON_KEY'],
};

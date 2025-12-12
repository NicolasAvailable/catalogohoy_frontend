import { authenticationEnvironment } from './authentication/environment.development';
import { globalEnvironment } from './global/global.development';

// Declare process for TypeScript
declare const process: any;

export const environment = {
  ...globalEnvironment,
  ...authenticationEnvironment,
  supabaseUrl: process.env['SUPABASE_URL'],
  supabaseKey: process.env['SUPABASE_ANON_KEY'],
};

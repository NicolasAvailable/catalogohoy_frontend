import { authenticationEnvironment } from './authentication/environment.development';
import { globalEnvironment } from './global/global.development';

// Use environment variables for Vercel deployment
const supabaseEnvironment = {
  supabase: {
    url:
      (globalThis as any)?.process?.env?.['SUPABASE_URL'] ||
      'https://your-project.supabase.co',
    anonKey:
      (globalThis as any)?.process?.env?.['SUPABASE_ANON_KEY'] ||
      'your-anon-key',
  },
};

export const environment = {
  ...globalEnvironment,
  ...authenticationEnvironment,
  ...supabaseEnvironment,
};

export const environment = {
  production: true,
  supabase: {
    url: (globalThis as any)?.process?.env?.['SUPABASE_URL'] || '',
    anonKey: (globalThis as any)?.process?.env?.['SUPABASE_ANON_KEY'] || '',
  },
};

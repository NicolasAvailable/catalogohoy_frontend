// Clave de la sesión en localStorage. supabase-js la deriva del host de
// supabaseUrl; la fijamos para que cambiar a un dominio propio
// (api.catalogohoy.com) no cierre la sesión de todos los usuarios.
export const SUPABASE_AUTH_STORAGE_KEY = 'sb-yvkurjivijnhliofmfmj-auth-token';

export const supabaseEnvironment = {
  supabaseUrl: 'https://yvkurjivijnhliofmfmj.supabase.co',
  supabaseAuthStorageKey: SUPABASE_AUTH_STORAGE_KEY,
  supabaseKey: 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs',
};

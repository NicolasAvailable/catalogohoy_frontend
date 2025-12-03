import { AuthApiError } from '@supabase/supabase-js';

export const errorMapper = (error: AuthApiError): Error => {
  const MAP_ERRORS: Record<string, string> = {
    user_already_exists: 'El usuario ya existe',
    weak_password: 'La contraseña debe tener al menos 6 caracteres',
  };
  return new Error(
    MAP_ERRORS[error.code as string] ?? 'Ha ocurrido un error desconocido'
  );
};

import { isDevMode } from '@angular/core';
import { type CanActivateFn } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';

export const authenticationGuard: CanActivateFn = async () => {
  if (isDevMode()) return true;

  const supabase = SupabaseClientProvider.getInstance();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    return true;
  } else {
    window.location.href = 'https://auth.catalogohoy.com';
    return false;
  }
};

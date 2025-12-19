import { type CanActivateFn } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';

export const authenticationGuard: CanActivateFn = async () => {
  const supabase = SupabaseClientProvider.getInstance();
  const { data } = await supabase.auth.getUser();
  console.log(data);
  if (data.user) {
    return true;
  } else {
    window.location.href = 'https://auth.catalogohoy.com';
    return false;
  }
};

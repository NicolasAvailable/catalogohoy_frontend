import { isDevMode } from '@angular/core';
import { environment } from '@catalogohoy/env';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Dev storage — delegates directly to localStorage. Previously removeItem
// was a no-op to "preserve manually pasted tokens", but that caused
// Supabase to loop when an invalid refresh token couldn't be cleared:
// refresh → 4xx → removeItem no-op → token persists → retry → …
// If you need to pin a token during a dev session, set `__sb_pin=1` in
// localStorage and the no-op comes back *only* for the auth-token key.
const devStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => {
    const pin = localStorage.getItem('__sb_pin');
    const isAuthToken = key.includes('-auth-token');
    if (pin === '1' && isAuthToken) return; // opt-in skip
    localStorage.removeItem(key);
  },
};

export class SupabaseClientProvider {
  private static client: SupabaseClient;

  static getInstance() {
    if (!this.client) {
      this.client = createClient(
        environment.supabaseUrl,
        environment.supabaseKey
      );
    }
    return this.client;
  }

  static create() {
    this.client = createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
      isDevMode() ? { auth: { storage: devStorage } } : {}
    );
  }
}

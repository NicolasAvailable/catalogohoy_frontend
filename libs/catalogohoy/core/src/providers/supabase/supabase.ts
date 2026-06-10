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

  private static build(): SupabaseClient {
    return createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
      isDevMode() ? { auth: { storage: devStorage } } : {}
    );
  }

  static getInstance() {
    if (!this.client) {
      this.client = this.build();
    }
    return this.client;
  }

  /**
   * Kept for the bootstrap call site (AppComponent). Idempotent on purpose:
   * a second createClient() spawns a second GoTrueClient that fights the first
   * for the Navigator LockManager lock on the auth token. That lock contention
   * made auth/RPC calls fail intermittently (aborted `tenant_exists_by_slug`),
   * which bounced authenticated users out of /admin. One client, always.
   */
  static create() {
    return this.getInstance();
  }
}

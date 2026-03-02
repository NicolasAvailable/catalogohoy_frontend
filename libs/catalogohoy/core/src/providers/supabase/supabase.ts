import { isDevMode } from '@angular/core';
import { environment } from '@catalogohoy/env';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// In development, Supabase must never delete tokens from localStorage
// (it does so when a refresh fails). This storage adapter is a no-op on removeItem.
const devStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (_key: string) => { /* intentional no-op */ },
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
      isDevMode() ? { auth: { storage: devStorage, autoRefreshToken: false } } : {}
    );
  }
}

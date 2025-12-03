import { environment } from '@catalogohoy/env';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
      environment.supabaseKey
    );
  }
}

import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '../supabase/supabase';

@Injectable({ providedIn: 'root' })
export class DiscordWebhookService {
  private readonly client = SupabaseClientProvider.getInstance();

  notifyCheckoutIntent(data: {
    tenantName: string | null;
    tenantSlug: string | null;
    planName: string;
    billingPeriod: string;
  }): void {
    this.client.functions
      .invoke('notify-checkout-intent', { body: data })
      .catch(() => {});
  }
}

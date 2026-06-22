import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { PlanCycle, PlanTier } from '../shared/plan-cycle.model';
import { PayingClient, SubscriptionHistoryEntry } from './paying-clients.model';

interface PayingClientRow {
  tenant_id: number;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_logo: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_avatar_url: string | null;
  tier: PlanTier;
  cycle: PlanCycle | null;
  started_at: string;
  expires_at: string | null;
  days_until_expiry: number | null;
  country_code: string | null;
}

interface HistoryRow {
  id: number;
  tier: PlanTier;
  cycle: PlanCycle;
  amount_usd: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  status: 'active' | 'expired' | 'cancelled';
  started_at: string;
  expires_at: string | null;
  created_at: string;
}

export interface WhatsappContact {
  name: string;
  number: string;
}

@Injectable({ providedIn: 'root' })
export class PayingClientsService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(): Promise<Either<Error, PayingClient[]>> {
    const { data, error } = await this.client.rpc('list_paying_clients_admin');

    if (error) {
      return E.left(new Error(error.message));
    }

    const clients: PayingClient[] = ((data as PayingClientRow[]) ?? []).map(
      (row) => ({
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        tenantLogo: row.tenant_logo,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        ownerAvatarUrl: row.owner_avatar_url,
        tier: row.tier,
        cycle: row.cycle,
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        daysUntilExpiry:
          row.days_until_expiry === null ? null : Number(row.days_until_expiry),
        countryCode: row.country_code ?? null,
      })
    );

    return E.right(clients);
  }

  /** Reads the catalog's configured WhatsApp buttons so the admin can reach
   *  out to the owner from the detail dialog. Relies on RLS allowing admins
   *  to read `tenant_ecommerce_config`; if a tenant has no buttons or no
   *  config row, returns an empty list rather than failing. */
  async getWhatsappNumbers(
    tenantId: number
  ): Promise<Either<Error, WhatsappContact[]>> {
    const { data, error } = await this.client
      .from('tenant_ecommerce_config')
      .select('whatsapp_buttons')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      return E.left(new Error(error.message));
    }

    const buttons = Array.isArray(data?.whatsapp_buttons)
      ? (data.whatsapp_buttons as WhatsappContact[])
      : [];
    return E.right(buttons.filter((b) => b?.number?.trim()));
  }

  async getHistory(
    tenantId: number
  ): Promise<Either<Error, SubscriptionHistoryEntry[]>> {
    const { data, error } = await this.client.rpc(
      'get_tenant_subscription_history_admin',
      { p_tenant_id: tenantId }
    );

    if (error) {
      return E.left(new Error(error.message));
    }

    const history: SubscriptionHistoryEntry[] = ((data as HistoryRow[]) ?? []).map(
      (row) => ({
        id: row.id,
        tier: row.tier,
        cycle: row.cycle,
        amountUsd: row.amount_usd === null ? null : Number(row.amount_usd),
        paymentMethod: row.payment_method,
        paymentReference: row.payment_reference,
        notes: row.notes,
        status: row.status,
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      })
    );

    return E.right(history);
  }
}

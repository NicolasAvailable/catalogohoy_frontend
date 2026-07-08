import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { EnterpriseLead, EnterpriseLeadStatus } from './enterprise-leads.model';

interface EnterpriseLeadRow {
  id: number;
  created_at: string;
  source: 'landing' | 'admin';
  tenant_slug: string | null;
  business_name: string;
  country: string | null;
  website: string | null;
  name: string;
  email: string;
  phone: string | null;
  products_range: string;
  orders_range: string;
  catalogs_needed: string;
  team_size: string;
  needs: string[] | null;
  score: number;
  qualified: boolean;
  status: EnterpriseLeadStatus;
}

@Injectable({ providedIn: 'root' })
export class EnterpriseLeadsService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(): Promise<Either<Error, EnterpriseLead[]>> {
    const { data, error } = await this.client.rpc('list_enterprise_leads_admin');

    if (error) {
      return E.left(new Error(error.message));
    }

    const leads: EnterpriseLead[] = ((data as EnterpriseLeadRow[]) ?? []).map(
      (row) => ({
        id: row.id,
        createdAt: row.created_at,
        source: row.source,
        tenantSlug: row.tenant_slug,
        businessName: row.business_name,
        country: row.country,
        website: row.website,
        name: row.name,
        email: row.email,
        phone: row.phone,
        productsRange: row.products_range,
        ordersRange: row.orders_range,
        catalogsNeeded: row.catalogs_needed,
        teamSize: row.team_size,
        needs: row.needs ?? [],
        score: Number(row.score),
        qualified: row.qualified,
        status: row.status,
      })
    );

    return E.right(leads);
  }

  async updateStatus(
    id: number,
    status: EnterpriseLeadStatus
  ): Promise<Either<Error, void>> {
    const { error } = await this.client.rpc(
      'update_enterprise_lead_status_admin',
      { p_id: id, p_status: status }
    );

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }
}

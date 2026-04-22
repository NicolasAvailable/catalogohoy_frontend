import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { Plan, PlanUpdate } from './plans.model';

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  max_products: number;
  max_catalogs: number;
  max_team_members: number | null;
  is_free: boolean;
  plan_position: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_quarterly: string | null;
  stripe_price_id_annual: string | null;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class PlansService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(): Promise<Either<Error, Plan[]>> {
    const { data, error } = await this.client.rpc('list_plans_admin');

    if (error) {
      return E.left(new Error(error.message));
    }

    const plans: Plan[] = ((data as PlanRow[]) ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price) || 0,
      maxProducts: row.max_products,
      maxCatalogs: row.max_catalogs,
      maxTeamMembers: row.max_team_members,
      isFree: row.is_free,
      position: row.plan_position,
      stripePriceIdMonthly: row.stripe_price_id_monthly,
      stripePriceIdQuarterly: row.stripe_price_id_quarterly,
      stripePriceIdAnnual: row.stripe_price_id_annual,
      updatedAt: row.updated_at,
    }));

    return E.right(plans);
  }

  async update(
    id: string,
    patch: PlanUpdate
  ): Promise<Either<Error, void>> {
    const { error } = await this.client.rpc('update_plan_admin', {
      p_id: id,
      p_name: patch.name ?? null,
      p_description: patch.description ?? null,
      p_price: patch.price ?? null,
      p_max_products: patch.maxProducts ?? null,
      p_max_catalogs: patch.maxCatalogs ?? null,
      p_max_team_members: patch.maxTeamMembers ?? null,
      p_position: patch.position ?? null,
      p_stripe_price_id_monthly: patch.stripePriceIdMonthly ?? null,
      p_stripe_price_id_quarterly: patch.stripePriceIdQuarterly ?? null,
      p_stripe_price_id_annual: patch.stripePriceIdAnnual ?? null,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}

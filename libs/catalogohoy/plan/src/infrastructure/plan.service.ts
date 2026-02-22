import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import {
  BasePlanService,
  Plan,
  TenantPlanExpiration,
  TenantPlanUsage,
} from '../domain';

@Injectable({ providedIn: 'root' })
export class PlanService implements BasePlanService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  public async getAll(): Promise<E.Either<Error, Plan[]>> {
    const { data, error } = await this.client
      .from('plans')
      .select('id, name, description, price, max_products, is_free, position')
      .order('position', { ascending: true });

    if (error) {
      return E.left(new Error(error.message));
    }

    const plans: Plan[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      maxProducts: row.max_products,
      isFree: row.is_free,
      position: row.position,
    }));

    return E.right(plans);
  }

  public async getTenantPlan(tenantId: number): Promise<E.Either<Error, Plan>> {
    const { data, error } = await this.client
      .from('tenants')
      .select(
        'plans:plan_id (id, name, description, price, max_products, is_free, position)'
      )
      .eq('id', tenantId)
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    const row = data?.plans as unknown as Record<string, unknown> | null;
    if (!row) {
      return E.left(new Error('Plan not found for tenant'));
    }

    return E.right({
      id: row['id'] as string,
      name: row['name'] as string,
      description: row['description'] as string,
      price: row['price'] as number,
      maxProducts: row['max_products'] as number,
      isFree: row['is_free'] as boolean,
      position: row['position'] as number,
    });
  }

  public async getProductCount(
    tenantId: number
  ): Promise<E.Either<Error, number>> {
    const { count, error } = await this.client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(count ?? 0);
  }

  public async getTenantPlanUsage(
    tenantId: number
  ): Promise<E.Either<Error, TenantPlanUsage>> {
    const planResult = await this.getTenantPlan(tenantId);
    if (planResult.isLeft()) {
      return E.left(planResult.value as Error);
    }

    const countResult = await this.getProductCount(tenantId);
    if (countResult.isLeft()) {
      return E.left(countResult.value as Error);
    }

    const expirationResult = await this.getTenantExpiration(tenantId);

    const plan = planResult.value as Plan;
    const currentProductCount = countResult.value as number;
    const remaining = plan.maxProducts - currentProductCount;

    const expiration = expirationResult.isRight()
      ? (expirationResult.value as TenantPlanExpiration)
      : { planExpired: false, planExpiresAt: null };

    return E.right({
      plan,
      currentProductCount,
      canCreateProduct: remaining > 0,
      remainingProducts: Math.max(0, remaining),
      planExpired: expiration.planExpired,
      planExpiresAt: expiration.planExpiresAt,
    });
  }

  public async getTenantExpiration(
    tenantId: number
  ): Promise<E.Either<Error, TenantPlanExpiration>> {
    const { data, error } = await this.client
      .from('tenants')
      .select('plan_started_at, plan_expires_at, plan_expired')
      .eq('id', tenantId)
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right({
      planStartedAt: data.plan_started_at,
      planExpiresAt: data.plan_expires_at,
      planExpired: data.plan_expired ?? false,
    });
  }

  public async getTenantExpiredBySlug(
    slug: string
  ): Promise<E.Either<Error, boolean>> {
    const { data, error } = await this.client
      .from('tenants')
      .select('plan_expired')
      .eq('slug', slug)
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(data.plan_expired ?? false);
  }
}

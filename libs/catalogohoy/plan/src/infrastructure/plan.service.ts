import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import {
  BasePlanService,
  Plan,
  TenantPlanExpiration,
  TenantPlanPublicInfo,
  TenantPlanUsage,
} from '../domain';

@Injectable({ providedIn: 'root' })
export class PlanService implements BasePlanService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  public async getAll(): Promise<E.Either<Error, Plan[]>> {
    const { data, error } = await this.client
      .from('plans')
      .select('id, name, description, price, max_products, max_catalogs, max_team_members, is_free, position')
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
      maxCatalogs: row.max_catalogs ?? 1,
      maxTeamMembers: row.max_team_members ?? 0,
      isFree: row.is_free,
      position: row.position,
    }));

    return E.right(plans);
  }

  public async getTenantPlan(tenantId: number): Promise<E.Either<Error, Plan>> {
    const { data, error } = await this.client
      .from('tenants')
      .select(
        'plans:plan_id (id, name, description, price, max_products, max_catalogs, max_team_members, is_free, position)'
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
      maxCatalogs: (row['max_catalogs'] as number) ?? 1,
      maxTeamMembers: (row['max_team_members'] as number) ?? 0,
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

  public async getCatalogCount(
    userId: number
  ): Promise<E.Either<Error, number>> {
    const { count, error } = await this.client
      .from('users_tenants')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(count ?? 0);
  }

  public async getTenantPlanUsage(
    tenantId: number,
    userId: number
  ): Promise<E.Either<Error, TenantPlanUsage>> {
    const planResult = await this.getTenantPlan(tenantId);
    if (planResult.isLeft()) {
      return E.left(planResult.value as Error);
    }

    const countResult = await this.getProductCount(tenantId);
    if (countResult.isLeft()) {
      return E.left(countResult.value as Error);
    }

    const catalogCountResult = await this.getCatalogCount(userId);
    const extraCatalogsResult = await this.getExtraCatalogs(tenantId);
    const expirationResult = await this.getTenantExpiration(tenantId);

    const plan = planResult.value as Plan;
    const currentProductCount = countResult.value as number;
    // `max_products = 0` is the unlimited sentinel (Avanzado plan onwards).
    // Treat it as effectively infinite so creation/import flows never gate.
    const isUnlimitedProducts = plan.maxProducts <= 0;
    const remaining = isUnlimitedProducts
      ? Number.MAX_SAFE_INTEGER
      : plan.maxProducts - currentProductCount;
    const currentCatalogCount = catalogCountResult.isRight()
      ? (catalogCountResult.value as number)
      : 1;
    const extraCatalogs = extraCatalogsResult.isRight()
      ? (extraCatalogsResult.value as number)
      : 0;
    const totalCatalogSlots = plan.maxCatalogs + extraCatalogs;
    const remainingCatalogs = Math.max(0, totalCatalogSlots - currentCatalogCount);

    const expiration = expirationResult.isRight()
      ? (expirationResult.value as TenantPlanExpiration)
      : { planExpired: false, planExpiresAt: null };

    return E.right({
      plan,
      currentProductCount,
      canCreateProduct: isUnlimitedProducts || remaining > 0,
      remainingProducts: isUnlimitedProducts ? Number.MAX_SAFE_INTEGER : Math.max(0, remaining),
      currentCatalogCount,
      canCreateCatalog: remainingCatalogs > 0,
      remainingCatalogs,
      extraCatalogs,
      planExpired: expiration.planExpired,
      planExpiresAt: expiration.planExpiresAt,
    });
  }

  public async getExtraCatalogs(
    tenantId: number
  ): Promise<E.Either<Error, number>> {
    const { data, error } = await this.client
      .from('tenants')
      .select('extra_catalogs')
      .eq('id', tenantId)
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(data?.extra_catalogs ?? 0);
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
  ): Promise<E.Either<Error, TenantPlanPublicInfo>> {
    const { data, error } = await this.client
      .from('tenants')
      .select('plan_expired, plans:plan_id (is_free)')
      .eq('slug', slug)
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    const plans = data?.plans as unknown as Record<string, unknown> | null;

    return E.right({
      planExpired: data.plan_expired ?? false,
      isFreePlan: (plans?.['is_free'] as boolean) ?? true,
    });
  }
}

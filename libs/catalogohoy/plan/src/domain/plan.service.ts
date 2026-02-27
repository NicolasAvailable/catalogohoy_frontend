import { E } from '@shared/domain';
import {
  Plan,
  TenantPlanExpiration,
  TenantPlanPublicInfo,
  TenantPlanUsage,
} from './plan.model';

export abstract class BasePlanService {
  abstract getAll(): Promise<E.Either<Error, Plan[]>>;
  abstract getTenantPlan(tenantId: number): Promise<E.Either<Error, Plan>>;
  abstract getTenantPlanUsage(
    tenantId: number,
    userId: number
  ): Promise<E.Either<Error, TenantPlanUsage>>;
  abstract getProductCount(tenantId: number): Promise<E.Either<Error, number>>;
  abstract getCatalogCount(userId: number): Promise<E.Either<Error, number>>;
  abstract getTenantExpiration(
    tenantId: number
  ): Promise<E.Either<Error, TenantPlanExpiration>>;
  abstract getTenantExpiredBySlug(
    slug: string
  ): Promise<E.Either<Error, TenantPlanPublicInfo>>;
}

import { E } from '@shared/domain';
import { Seller, SellerCommissionRow, SellerInput, SellerOrder } from './seller.model';

export abstract class BaseSellerService {
  abstract list(tenantId: number): Promise<E.Either<Error, Seller[]>>;
  abstract create(tenantId: number, input: SellerInput): Promise<E.Either<Error, Seller>>;
  abstract update(tenantId: number, id: string, input: Partial<SellerInput>): Promise<E.Either<Error, Seller>>;
  abstract remove(tenantId: number, id: string): Promise<E.Either<Error, void>>;
  /** Reporte por vendedor de las órdenes creadas en [from, to). */
  abstract commissions(tenantId: number, from: string, to: string): Promise<E.Either<Error, SellerCommissionRow[]>>;
  /** Órdenes de un vendedor en [from, to). */
  abstract orders(tenantId: number, sellerId: string, from: string, to: string): Promise<E.Either<Error, SellerOrder[]>>;
  /** Marca/desmarca como pagadas las comisiones (órdenes completadas) del rango. */
  abstract setPaid(sellerId: string, from: string, to: string, paid: boolean): Promise<E.Either<Error, number>>;
}

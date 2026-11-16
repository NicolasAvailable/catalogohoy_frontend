import { E } from '@shared/domain';
import { Expense, ExpenseInput } from './expense.model';

export abstract class BaseExpenseService {
  /** Gastos de la tienda con fecha de factura en [from, to). */
  abstract list(tenantId: number, from: string, to: string): Promise<E.Either<Error, Expense[]>>;
  abstract create(tenantId: number, input: ExpenseInput): Promise<E.Either<Error, Expense>>;
  abstract update(tenantId: number, id: string, input: Partial<ExpenseInput>): Promise<E.Either<Error, Expense>>;
  abstract remove(tenantId: number, id: string): Promise<E.Either<Error, void>>;
  /** Sube el archivo de la factura (foto o PDF) y devuelve su URL pública. */
  abstract uploadFile(tenantId: number, file: File): Promise<E.Either<Error, string>>;
}

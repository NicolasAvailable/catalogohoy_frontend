import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { BusinessExpense, ExpensePeriod } from './business-expenses.model';

interface BusinessExpenseRow {
  id: number;
  name: string;
  company: string;
  amount_usd: number | string;
  period: ExpensePeriod;
  created_at: string;
}

export interface SaveExpenseInput {
  id: number | null;
  name: string;
  company: string;
  amountUsd: number;
  period: ExpensePeriod;
}

@Injectable({ providedIn: 'root' })
export class BusinessExpensesService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(): Promise<Either<Error, BusinessExpense[]>> {
    const { data, error } = await this.client.rpc(
      'list_business_expenses_admin'
    );

    if (error) {
      return E.left(new Error(error.message));
    }

    const expenses: BusinessExpense[] = (
      (data as BusinessExpenseRow[]) ?? []
    ).map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company,
      amountUsd: Number(row.amount_usd),
      period: row.period,
      createdAt: row.created_at,
    }));

    return E.right(expenses);
  }

  async save(input: SaveExpenseInput): Promise<Either<Error, number>> {
    const { data, error } = await this.client.rpc(
      'save_business_expense_admin',
      {
        p_id: input.id,
        p_name: input.name,
        p_company: input.company,
        p_amount_usd: input.amountUsd,
        p_period: input.period,
      }
    );

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(Number(data));
  }

  async remove(id: number): Promise<Either<Error, void>> {
    const { error } = await this.client.rpc('delete_business_expense_admin', {
      p_id: id,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}

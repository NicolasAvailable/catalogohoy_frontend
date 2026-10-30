import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { compressImage, preferredImageFormat, signedUpload } from '@ui';
import { BaseExpenseService, Expense, ExpenseInput } from '../domain';

const TABLE = 'tenant_expenses';
const COLUMNS =
  'id, supplier, invoice_number, category, description, amount, currency, issue_date, due_date, status, paid_at, file_url, file_name, notes, created_at';

/** Gastos de la tienda (`tenant_expenses`). RLS: dueño o permiso `gastos`. */
@Injectable({ providedIn: 'root' })
export class ExpenseService extends BaseExpenseService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(tenantId: number, from: string, to: string): Promise<E.Either<Error, Expense[]>> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .gte('issue_date', from)
      .lt('issue_date', to)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) return E.left(new Error(error.message));
    return E.right((data ?? []).map(ExpenseService.toDomain));
  }

  async create(tenantId: number, input: ExpenseInput): Promise<E.Either<Error, Expense>> {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ ...ExpenseService.toRow(input), tenant_id: tenantId })
      .select(COLUMNS)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(ExpenseService.toDomain(data));
  }

  async update(
    tenantId: number,
    id: string,
    input: Partial<ExpenseInput>
  ): Promise<E.Either<Error, Expense>> {
    const { data, error } = await this.client
      .from(TABLE)
      .update(ExpenseService.toRow(input))
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(COLUMNS)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(ExpenseService.toDomain(data));
  }

  async remove(tenantId: number, id: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client.from(TABLE).delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async uploadFile(tenantId: number, file: File): Promise<E.Either<Error, string>> {
    try {
      // Las fotos se comprimen (las de celular pesan varios MB); los PDF van tal cual.
      if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        const blob = await compressImage(file, { maxWidth: 2000, quality: 0.85 });
        const { mime } = preferredImageFormat();
        return E.right(await signedUpload(blob, file.name, mime, 'invoice', tenantId));
      }
      return E.right(
        await signedUpload(file, file.name, file.type || 'application/pdf', 'invoice', tenantId)
      );
    } catch (e) {
      return E.left(e instanceof Error ? e : new Error('No pudimos subir el archivo.'));
    }
  }

  private static toRow(input: Partial<ExpenseInput>): Record<string, unknown> {
    const map: Record<keyof ExpenseInput, string> = {
      supplier: 'supplier',
      invoiceNumber: 'invoice_number',
      category: 'category',
      description: 'description',
      amount: 'amount',
      currency: 'currency',
      issueDate: 'issue_date',
      dueDate: 'due_date',
      status: 'status',
      paidAt: 'paid_at',
      fileUrl: 'file_url',
      fileName: 'file_name',
      notes: 'notes',
    };
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const column = map[key as keyof ExpenseInput];
      if (column && value !== undefined) row[column] = value;
    }
    return row;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static toDomain(row: any): Expense {
    return {
      id: row.id,
      supplier: row.supplier ?? null,
      invoiceNumber: row.invoice_number ?? null,
      category: row.category,
      description: row.description ?? null,
      amount: Number(row.amount) || 0,
      currency: row.currency,
      issueDate: row.issue_date,
      dueDate: row.due_date ?? null,
      status: row.status,
      paidAt: row.paid_at ?? null,
      fileUrl: row.file_url ?? null,
      fileName: row.file_name ?? null,
      notes: row.notes ?? null,
      createdAt: row.created_at,
    };
  }
}

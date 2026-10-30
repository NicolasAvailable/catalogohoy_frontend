import { Component, computed, inject, output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  DatepickerComponent,
  DialogComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  SelectComponent,
  TextareaComponent,
} from '@ui';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ExpenseStatus,
  fromIsoDate,
  toIsoDate,
} from '../../../domain';
import { ExpenseStore } from '../../../infrastructure';

/** Máximo por archivo (fotos se comprimen; esto aplica sobre todo a PDF). */
const MAX_FILE_MB = 15;

@Component({
  selector: 'lib-expense-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    DialogComponent,
    InputTextComponent,
    InputNumberComponent,
    TextareaComponent,
    SelectComponent,
    DatepickerComponent,
    ButtonComponent,
    IconComponent,
    TranslocoPipe,
  ],
  templateUrl: './expense-form-dialog.html',
})
export class ExpenseFormDialogComponent {
  public readonly store = inject(ExpenseStore);
  private readonly currency = inject(TenantCurrencyStore);
  private readonly toast = inject(ToastService);

  @ViewChild(DialogComponent) private dialog!: DialogComponent;

  public readonly saved = output<void>();

  public readonly categories = EXPENSE_CATEGORIES;
  public readonly statuses = EXPENSE_STATUSES;
  /** Moneda de referencia + moneda local (p. ej. USD y VES) si son distintas. */
  public readonly currencies = computed(() => {
    const codes = [this.currency.displayCode() || 'USD', this.currency.localCode() || 'USD'];
    return [...new Set(codes)].map((code) => ({ value: code, label: code }));
  });

  public readonly editingId = signal<string | null>(null);
  public readonly supplier = signal('');
  public readonly invoiceNumber = signal('');
  public readonly category = signal<ExpenseCategory>('mercancia');
  public readonly description = signal('');
  public readonly amount = signal<number | null>(null);
  public readonly currencyCode = signal('USD');
  public readonly issueDate = signal<Date | null>(new Date());
  public readonly dueDate = signal<Date | null>(null);
  public readonly status = signal<ExpenseStatus>('paid');
  public readonly fileUrl = signal<string | null>(null);
  public readonly fileName = signal<string | null>(null);
  public readonly notes = signal('');
  public readonly submitted = signal(false);
  public readonly isUploading = signal(false);
  private paidAt: string | null = null;

  public get isEditing(): boolean {
    return this.editingId() !== null;
  }

  public open(expense: Expense | null = null): void {
    this.submitted.set(false);
    this.isUploading.set(false);
    this.editingId.set(expense?.id ?? null);
    this.supplier.set(expense?.supplier ?? '');
    this.invoiceNumber.set(expense?.invoiceNumber ?? '');
    this.category.set(expense?.category ?? 'mercancia');
    this.description.set(expense?.description ?? '');
    this.amount.set(expense?.amount ?? null);
    this.currencyCode.set(expense?.currency ?? this.currencies()[0].value);
    this.issueDate.set(expense ? fromIsoDate(expense.issueDate) : new Date());
    this.dueDate.set(expense?.dueDate ? fromIsoDate(expense.dueDate) : null);
    this.status.set(expense?.status ?? 'paid');
    this.fileUrl.set(expense?.fileUrl ?? null);
    this.fileName.set(expense?.fileName ?? null);
    this.notes.set(expense?.notes ?? '');
    this.paidAt = expense?.paidAt ?? null;
    this.dialog.show();
  }

  public close(): void {
    this.dialog.hide();
  }

  public async onFileSelected(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      this.toast.warning('Sube una foto o un PDF de la factura.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      this.toast.warning(`El archivo pesa más de ${MAX_FILE_MB} MB.`);
      return;
    }
    this.isUploading.set(true);
    const url = await this.store.uploadFile(file);
    this.isUploading.set(false);
    if (!url) {
      this.toast.warning('No pudimos subir el archivo. Intenta de nuevo.');
      return;
    }
    this.fileUrl.set(url);
    this.fileName.set(file.name);
  }

  public removeFile(): void {
    this.fileUrl.set(null);
    this.fileName.set(null);
  }

  public async save(): Promise<void> {
    this.submitted.set(true);
    const amount = this.amount();
    const issueDate = this.issueDate();
    if (amount === null || amount < 0 || !issueDate) return;
    if (!this.supplier().trim() && !this.description().trim()) return;

    const status = this.status();
    const dueDate = this.dueDate();
    const input: ExpenseInput = {
      supplier: this.supplier().trim() || null,
      invoiceNumber: this.invoiceNumber().trim() || null,
      category: this.category(),
      description: this.description().trim() || null,
      amount: Math.round(amount * 100) / 100,
      currency: this.currencyCode(),
      issueDate: toIsoDate(issueDate),
      dueDate: status === 'pending' && dueDate ? toIsoDate(dueDate) : null,
      status,
      paidAt: status === 'paid' ? (this.paidAt ?? toIsoDate(new Date())) : null,
      fileUrl: this.fileUrl(),
      fileName: this.fileName(),
      notes: this.notes().trim() || null,
    };

    const ok = await this.store.save(this.editingId(), input);
    if (ok) {
      this.toast.success(this.isEditing ? 'Gasto actualizado' : 'Gasto registrado');
      this.dialog.hide();
      this.saved.emit();
    } else {
      this.toast.warning('No se pudo guardar el gasto. Intenta de nuevo.');
    }
  }
}

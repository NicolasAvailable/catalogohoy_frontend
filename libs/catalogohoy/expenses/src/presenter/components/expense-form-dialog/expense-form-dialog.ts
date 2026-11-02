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
  attachmentIcon,
  EXPENSE_CATEGORIES,
  EXPENSE_FILE_ACCEPT,
  EXPENSE_STATUSES,
  Expense,
  ExpenseAttachment,
  ExpenseCategory,
  ExpenseInput,
  ExpenseStatus,
  fromIsoDate,
  isAllowedExpenseFile,
  toIsoDate,
} from '../../../domain';
import { ExpenseStore } from '../../../infrastructure';

/** Máximo por archivo (fotos se comprimen; esto aplica sobre todo a PDF/Excel). */
const MAX_FILE_MB = 15;
/** Máximo de archivos por gasto. */
const MAX_FILES = 10;

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
  public readonly attachments = signal<ExpenseAttachment[]>([]);
  public readonly fileAccept = EXPENSE_FILE_ACCEPT;
  public readonly attachmentIcon = attachmentIcon;
  public readonly isDragOver = signal(false);
  public readonly notes = signal('');
  public readonly submitted = signal(false);
  /** Cuántos archivos se están subiendo ahora. */
  public readonly uploadingCount = signal(0);
  public readonly isUploading = computed(() => this.uploadingCount() > 0);
  private paidAt: string | null = null;

  public get isEditing(): boolean {
    return this.editingId() !== null;
  }

  public open(expense: Expense | null = null): void {
    this.submitted.set(false);
    this.uploadingCount.set(0);
    this.isDragOver.set(false);
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
    this.attachments.set(expense?.attachments ?? []);
    this.notes.set(expense?.notes ?? '');
    this.paidAt = expense?.paidAt ?? null;
    this.dialog.show();
  }

  public close(): void {
    this.dialog.hide();
  }

  public onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const files = Array.from(inputEl.files ?? []);
    inputEl.value = '';
    this.addFiles(files);
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  public removeAttachment(index: number): void {
    this.attachments.update((list) => list.filter((_, i) => i !== index));
  }

  private async addFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    const room = MAX_FILES - this.attachments().length - this.uploadingCount();
    if (room <= 0) {
      this.toast.warning(`Máximo ${MAX_FILES} archivos por gasto.`);
      return;
    }
    const valid = files.filter((f) => {
      if (!isAllowedExpenseFile(f)) {
        this.toast.warning(`"${f.name}" no es un tipo de archivo permitido.`);
        return false;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        this.toast.warning(`"${f.name}" pesa más de ${MAX_FILE_MB} MB.`);
        return false;
      }
      return true;
    });
    await Promise.all(
      valid.slice(0, room).map(async (file) => {
        this.uploadingCount.update((n) => n + 1);
        const url = await this.store.uploadFile(file);
        this.uploadingCount.update((n) => n - 1);
        if (!url) {
          this.toast.warning(`No pudimos subir "${file.name}". Intenta de nuevo.`);
          return;
        }
        this.attachments.update((list) => [
          ...list,
          { url, name: file.name, type: file.type || 'application/octet-stream' },
        ]);
      })
    );
  }

  public async save(): Promise<void> {
    this.submitted.set(true);
    const amount = this.amount();
    const issueDate = this.issueDate();
    if (amount === null || amount < 0 || !issueDate) return;
    if (!this.supplier().trim()) return;

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
      attachments: this.attachments(),
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

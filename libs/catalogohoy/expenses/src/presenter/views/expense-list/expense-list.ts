import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  IconComponent,
  InputSearchComponent,
} from '@ui';
import { TooltipModule } from 'primeng/tooltip';
import {
  categoryLabel,
  currentMonth,
  Expense,
  ExpenseStatus,
  isOverdue,
  shiftMonth,
  toIsoDate,
} from '../../../domain';
import { ExpenseStore } from '../../../infrastructure';
import { ExpenseFormDialogComponent } from '../../components/expense-form-dialog/expense-form-dialog';

type StatusFilter = 'all' | ExpenseStatus;

@Component({
  selector: 'lib-expense-list',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ButtonComponent,
    ConfirmDialogComponent,
    IconComponent,
    InputSearchComponent,
    TooltipModule,
    TranslocoPipe,
    ExpenseFormDialogComponent,
  ],
  templateUrl: './expense-list.html',
  host: { class: 'flex-1 flex flex-col min-h-0' },
})
export default class ExpenseListComponent implements OnInit {
  public readonly store = inject(ExpenseStore);
  private readonly currency = inject(TenantCurrencyStore);
  private readonly permissions = inject(TeamPermissionsStore);
  private readonly toast = inject(ToastService);

  @ViewChild(ExpenseFormDialogComponent) private formDialog!: ExpenseFormDialogComponent;
  @ViewChild(ConfirmDialogComponent) private confirmDialog!: ConfirmDialogComponent;

  public readonly searchQuery = signal('');
  public readonly statusFilter = signal<StatusFilter>('all');
  private readonly toDelete = signal<Expense | null>(null);

  public readonly statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'pending', label: 'Por pagar' },
    { value: 'paid', label: 'Pagados' },
  ];

  public readonly canCreate = computed(() => this.can('create'));
  public readonly canEdit = computed(() => this.can('edit'));
  public readonly canDelete = computed(() => this.can('delete'));

  public readonly isCurrentMonth = computed(() => this.store.month() === currentMonth());
  public readonly monthLabel = computed(() => {
    const [y, m] = this.store.month().split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  public readonly mainTotals = computed(() => this.store.totals()[0]);
  public readonly otherTotals = computed(() => this.store.totals().slice(1));
  public readonly maxCategory = computed(() =>
    Math.max(1, ...this.store.byCategory().map((c) => c.total))
  );

  public readonly filtered = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    return this.store.expenses().filter((e) => {
      if (status !== 'all' && e.status !== status) return false;
      if (!q) return true;
      return [e.supplier, e.description, e.invoiceNumber, e.notes, categoryLabel(e.category)]
        .some((v) => v?.toLowerCase().includes(q));
    });
  });

  public readonly confirmContent = computed(() => {
    const e = this.toDelete();
    if (!e) return '';
    const name = e.supplier || e.description || 'este gasto';
    return `Se eliminará "${name}" por ${this.money(e.amount, e.currency)}. Esta acción no se puede deshacer.`;
  });

  public readonly categoryLabel = categoryLabel;
  private readonly today = toIsoDate(new Date());

  ngOnInit(): void {
    this.store.load();
  }

  public changeMonth(delta: number): void {
    this.store.load(shiftMonth(this.store.month(), delta));
  }

  public goToCurrentMonth(): void {
    this.store.load(currentMonth());
  }

  public openAdd(): void {
    this.formDialog.open();
  }

  public openEdit(expense: Expense): void {
    if (!this.canEdit()) return;
    this.formDialog.open(expense);
  }

  public async togglePaid(expense: Expense): Promise<void> {
    const paid = expense.status === 'paid';
    const ok = await this.store.setStatus(
      expense,
      paid ? 'pending' : 'paid',
      paid ? null : toIsoDate(new Date())
    );
    if (ok) this.toast.success(paid ? 'Marcado como por pagar' : 'Marcado como pagado');
    else this.toast.warning('No se pudo actualizar el gasto.');
  }

  public askDelete(expense: Expense): void {
    this.toDelete.set(expense);
    this.confirmDialog.warning();
  }

  public async onConfirmDelete(): Promise<void> {
    const expense = this.toDelete();
    if (!expense) return;
    const ok = await this.store.remove(expense.id);
    this.toDelete.set(null);
    if (ok) this.toast.success('Gasto eliminado');
    else this.toast.warning('No se pudo eliminar el gasto.');
  }

  public overdue(expense: Expense): boolean {
    return isOverdue(expense, this.today);
  }

  /** Monto con el símbolo de la moneda de la tienda (o el código ISO). */
  public money(amount: number, code: string): string {
    const symbol =
      code === this.currency.displayCode()
        ? this.currency.displaySymbol()
        : code === this.currency.localCode()
          ? this.currency.localSymbol()
          : code;
    const value = amount.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${value}`;
  }

  /** 'YYYY-MM-DD' → '05/10/2026'. */
  public date(iso: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private can(action: 'create' | 'edit' | 'delete'): boolean {
    return this.permissions.isOwner() || this.permissions.can()('gastos', action);
  }
}

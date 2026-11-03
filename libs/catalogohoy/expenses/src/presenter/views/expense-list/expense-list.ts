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
  DialogService,
  IconComponent,
  InputSearchComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
  StackedDayChartComponent, ModuleEmptyComponent, ModuleEmptyPreviewRow } from '@ui';
import { TooltipModule } from 'primeng/tooltip';
import {
  categoryLabel,
  currentMonth,
  dailyBreakdown,
  EXPENSE_CATEGORY_COLORS,
  ExpenseBreakdown,
  Expense,
  ExpenseStatusDef,
  ExpenseStatusKey,
  expenseStatusKeyOf,
  isOverdue,
  NEW_EXPENSE_STAGE_KEY,
  pendingAmount,
  resolveExpenseStatusKey,
  shiftMonth,
  toIsoDate,
} from '../../../domain';
import { ExpenseStageStore, ExpenseStore } from '../../../infrastructure';
import { openExpenseStagesEditor } from '../../components/expense-stages-modal/expense-stages-modal';
import { ExpenseFormDialogComponent } from '../../components/expense-form-dialog/expense-form-dialog';

type StatusFilter = 'all' | ExpenseStatusKey;

@Component({
  selector: 'lib-expense-list',
  standalone: true,
  imports: [ModuleEmptyComponent,
    NgTemplateOutlet,
    FormsModule,
    ButtonComponent,
    ConfirmDialogComponent,
    IconComponent,
    InputSearchComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    StackedDayChartComponent,
    TooltipModule,
    TranslocoPipe,
    ExpenseFormDialogComponent,
  ],
  templateUrl: './expense-list.html',
  host: { class: 'flex-1 flex flex-col min-h-0' },
})
export default class ExpenseListComponent implements OnInit {
  /** Datos de ejemplo de la vista vacía (panel derecho). */
  public readonly emptyPreview: ModuleEmptyPreviewRow[] = [
    { label: 'Distribuidora Central', sub: 'Mercancía · vence el 15', value: '$1,250', badge: 'Pendiente', badgeClass: 'bg-amber-50 text-amber-700' },
    { label: 'Alquiler del local', sub: 'Fijo mensual', value: '$600', badge: 'Pagado', badgeClass: 'bg-emerald-50 text-emerald-700' },
    { label: 'Internet', sub: 'Servicios', value: '$45', badge: 'Pagado', badgeClass: 'bg-emerald-50 text-emerald-700' },
    { label: 'Publicidad Instagram', sub: 'Marketing · pago único', value: '$80', badge: 'Abonado', badgeClass: 'bg-sky-50 text-sky-700' },
  ];

  public readonly store = inject(ExpenseStore);
  private readonly currency = inject(TenantCurrencyStore);
  private readonly permissions = inject(TeamPermissionsStore);
  private readonly toast = inject(ToastService);
  public readonly stageStore = inject(ExpenseStageStore);
  private readonly dialogService = inject(DialogService);

  @ViewChild(ExpenseFormDialogComponent) private formDialog!: ExpenseFormDialogComponent;
  @ViewChild(ConfirmDialogComponent) private confirmDialog!: ConfirmDialogComponent;

  public readonly searchQuery = signal('');
  public readonly statusFilter = signal<StatusFilter>('all');
  private readonly toDelete = signal<Expense | null>(null);

  /** Filtros: Todos + los estados visibles de la tienda (base y propios). */
  public readonly statusFilters = computed<{ value: StatusFilter; label: string; color: string | null }[]>(() => [
    { value: 'all', label: 'Todos', color: null },
    ...this.stageStore.visibleDefs().map((d) => ({ value: d.key, label: d.label, color: d.color })),
  ]);

  /** Opciones del selector de estado de cada gasto (+ "Crear estado"). */
  public readonly statusOptions = computed(() => [
    ...this.stageStore.visibleDefs().map((d) => ({ value: d.key as string, label: d.label, color: d.color })),
    { value: NEW_EXPENSE_STAGE_KEY, label: 'Crear estado', color: '' },
  ]);
  public readonly NEW_STAGE_KEY = NEW_EXPENSE_STAGE_KEY;

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

  /** Gráfica "Gastos por día": apilada por categoría o por estado. */
  public readonly breakdown = signal<ExpenseBreakdown>('category');
  public readonly breakdownOptions: { value: ExpenseBreakdown; label: string }[] = [
    { value: 'category', label: 'Por categoría' },
    { value: 'status', label: 'Por estado' },
  ];
  public readonly daily = computed(() =>
    dailyBreakdown(
      this.store.expenses(),
      this.store.month(),
      this.store.mainCurrency(),
      this.breakdown(),
      this.stageStore.defs()
    )
  );
  public readonly formatMain = (v: number) => this.money(v, this.store.mainCurrency());

  public readonly filtered = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const defs = this.stageStore.defs();
    return this.store.expenses().filter((e) => {
      if (status !== 'all' && expenseStatusKeyOf(e, defs) !== status) return false;
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
  public readonly categoryColors = EXPENSE_CATEGORY_COLORS;
  private readonly today = toIsoDate(new Date());

  ngOnInit(): void {
    this.store.load();
    this.stageStore.load();
  }

  public statusKey(expense: Expense): ExpenseStatusKey {
    return expenseStatusKeyOf(expense, this.stageStore.defs());
  }

  public statusDef(expense: Expense): ExpenseStatusDef | undefined {
    return this.stageStore.def(this.statusKey(expense));
  }

  /** Opciones del selector de un gasto: si está en un estado oculto, se agrega. */
  public optionsFor(expense: Expense) {
    const opts = this.statusOptions();
    const def = this.statusDef(expense);
    if (!def?.hidden) return opts;
    return [...opts.slice(0, -1), { value: def.key as string, label: def.label, color: def.color }, opts[opts.length - 1]];
  }

  public openStagesEditor(): void {
    const ref = openExpenseStagesEditor(this.dialogService);
    ref?.onClose.subscribe(() => {
      // Si el filtro apuntaba a un estado que ya no existe o se ocultó, volver a Todos.
      const f = this.statusFilter();
      if (f !== 'all' && !this.stageStore.visibleDefs().some((d) => d.key === f)) this.statusFilter.set('all');
    });
  }

  public async changeStatus(expense: Expense, key: string): Promise<void> {
    if (key === NEW_EXPENSE_STAGE_KEY) {
      const ref = openExpenseStagesEditor(this.dialogService, true);
      ref?.onClose.subscribe((created?: ExpenseStatusDef) => {
        if (created) this.changeStatus(expense, created.key);
      });
      return;
    }
    if (key === this.statusKey(expense)) return;
    const target = resolveExpenseStatusKey(key as ExpenseStatusKey, this.stageStore.defs());
    if (!target) return;
    const paid = target.status === 'paid';
    const ok = await this.store.patch(expense, {
      status: target.status,
      stageId: target.stageId,
      paidAt: paid ? (expense.paidAt ?? toIsoDate(new Date())) : null,
    });
    if (ok) this.toast.success('Estado actualizado');
    else this.toast.warning('No se pudo actualizar el gasto.');
  }

  public pendingAmount = pendingAmount;

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
    const ok = await this.store.patch(expense, {
      status: paid ? 'pending' : 'paid',
      stageId: null,
      paidAt: paid ? null : toIsoDate(new Date()),
    });
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

  public attachmentNames(expense: Expense): string {
    return expense.attachments.map((a) => a.name).join(', ');
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

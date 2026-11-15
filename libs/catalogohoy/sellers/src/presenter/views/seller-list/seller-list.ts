import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { PlanStore } from '@catalogohoy/plan';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  IconComponent,
  PremiumUpgradePromptComponent,
} from '@ui';
import { TooltipModule } from 'primeng/tooltip';
import * as XLSX from 'xlsx';
import {
  currentMonth,
  Seller,
  SellerCommissionRow,
  sellerLimitForPlan,
  sellerLink,
  SellerOrder,
  shiftMonth,
} from '../../../domain';
import { SellerStore } from '../../../infrastructure';
import { SellerFormDialogComponent } from '../../components/seller-form-dialog/seller-form-dialog';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Completada',
  cancelled: 'Cancelada',
  credit: 'A crédito',
};

@Component({
  selector: 'lib-seller-list',
  standalone: true,
  imports: [
    ButtonComponent,
    ConfirmDialogComponent,
    IconComponent,
    PremiumUpgradePromptComponent,
    TooltipModule,
    TranslocoPipe,
    SellerFormDialogComponent,
  ],
  templateUrl: './seller-list.html',
  host: { class: 'flex-1 flex flex-col min-h-0' },
})
export default class SellerListComponent implements OnInit {
  public readonly store = inject(SellerStore);
  private readonly planStore = inject(PlanStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly currency = inject(TenantCurrencyStore);
  private readonly permissions = inject(TeamPermissionsStore);
  private readonly toast = inject(ToastService);

  @ViewChild(SellerFormDialogComponent) private formDialog!: SellerFormDialogComponent;
  @ViewChild(ConfirmDialogComponent) private confirmDialog!: ConfirmDialogComponent;

  public readonly planLoaded = signal(false);
  public readonly limit = computed(() => sellerLimitForPlan(this.planStore.currentPlan()?.id));
  public readonly planName = computed(() => this.planStore.currentPlan()?.name ?? '');
  public readonly atLimit = computed(() => this.store.sellers().length >= this.limit());
  public readonly limitLabel = computed(() =>
    Number.isFinite(this.limit()) ? `${this.store.sellers().length} de ${this.limit()}` : ''
  );

  public readonly catalogUrl = computed(() => this.tenantStore.defaultTenant()?.url ?? '');
  public readonly canCreate = computed(() => this.can('create'));
  public readonly canEdit = computed(() => this.can('edit'));
  public readonly canDelete = computed(() => this.can('delete'));

  public readonly isCurrentMonth = computed(() => this.store.month() === currentMonth());
  public readonly monthLabel = computed(() => {
    const [y, m] = this.store.month().split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  /** Vendedor (fila del reporte) → datos completos para editar. */
  private readonly sellersById = computed(() => new Map(this.store.sellers().map((s) => [s.id, s])));

  public readonly expanded = signal<string | null>(null);
  public readonly expandedOrders = signal<SellerOrder[]>([]);
  public readonly loadingOrders = signal(false);
  public readonly payingId = signal<string | null>(null);
  public readonly copiedId = signal<string | null>(null);
  private readonly toDelete = signal<SellerCommissionRow | null>(null);

  public readonly confirmContent = computed(() => {
    const r = this.toDelete();
    if (!r) return '';
    return `Se eliminará a "${r.name}". Su link deja de funcionar. Las órdenes que ya vendió se quedan, pero sin vendedor asignado.`;
  });

  async ngOnInit(): Promise<void> {
    await this.planStore.loadTenantPlanUsage();
    this.planLoaded.set(true);
    // Se carga aunque el plan no permita: si bajó de plan, ve sus vendedores
    // y comisiones anteriores (pero no puede agregar).
    this.store.load();
  }

  public link(row: { slug: string }): string {
    return sellerLink(this.catalogUrl(), row.slug);
  }

  public async copyLink(row: SellerCommissionRow): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link(row));
      this.copiedId.set(row.sellerId);
      setTimeout(() => this.copiedId.set(null), 1800);
      this.toast.success('Link copiado');
    } catch {
      this.toast.warning('No se pudo copiar el link.');
    }
  }

  public changeMonth(delta: number): void {
    this.expanded.set(null);
    this.store.load(shiftMonth(this.store.month(), delta));
  }

  public goToCurrentMonth(): void {
    this.expanded.set(null);
    this.store.load(currentMonth());
  }

  public openAdd(): void {
    if (this.atLimit()) {
      this.toast.warning('Llegaste al límite de vendedores de tu plan.');
      return;
    }
    this.formDialog.open();
  }

  public openEdit(row: SellerCommissionRow): void {
    const seller = this.sellersById().get(row.sellerId);
    if (seller && this.canEdit()) this.formDialog.open(seller as Seller);
  }

  public async toggleOrders(row: SellerCommissionRow): Promise<void> {
    if (this.expanded() === row.sellerId) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(row.sellerId);
    this.expandedOrders.set([]);
    this.loadingOrders.set(true);
    const orders = await this.store.orders(row.sellerId);
    if (this.expanded() === row.sellerId) this.expandedOrders.set(orders);
    this.loadingOrders.set(false);
  }

  public async setPaid(row: SellerCommissionRow, paid: boolean): Promise<void> {
    this.payingId.set(row.sellerId);
    const result = await this.store.setPaid(row.sellerId, paid);
    this.payingId.set(null);
    result.fold(
      (msg) => this.toast.warning(msg),
      () => {
        this.toast.success(paid ? 'Comisión marcada como pagada' : 'Comisión marcada como pendiente');
        if (this.expanded() === row.sellerId) {
          this.expanded.set(null);
          this.toggleOrders(row);
        }
      }
    );
  }

  public askDelete(row: SellerCommissionRow): void {
    this.toDelete.set(row);
    this.confirmDialog.warning();
  }

  public async onConfirmDelete(): Promise<void> {
    const row = this.toDelete();
    if (!row) return;
    const error = await this.store.remove(row.sellerId);
    this.toDelete.set(null);
    if (error) this.toast.warning(error);
    else this.toast.success('Vendedor eliminado');
  }

  /** Excel del mes: una hoja con el resumen por vendedor. */
  public exportExcel(): void {
    const symbol = this.symbol();
    const rows = this.store.report().map((r) => ({
      Vendedor: r.name,
      Link: this.link(r),
      'Comisión (%)': r.commissionPct,
      'Órdenes completadas': r.completedOrders,
      [`Ventas (${symbol})`]: r.sales,
      [`Comisión (${symbol})`]: r.commission,
      [`Pagado (${symbol})`]: r.commissionPaid,
      [`Por pagar (${symbol})`]: r.commissionPending,
      'Órdenes abiertas': r.openOrders,
      [`Ventas abiertas (${symbol})`]: r.openSales,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comisiones');
    XLSX.writeFile(wb, `comisiones_vendedores_${this.store.month()}.xlsx`);
  }

  public statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  public symbol(): string {
    return this.currency.displaySymbol() || '$';
  }

  public money(amount: number): string {
    return `${this.symbol()} ${amount.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  public date(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private can(action: 'create' | 'edit' | 'delete'): boolean {
    return this.permissions.isOwner() || this.permissions.can()('vendedores', action);
  }
}

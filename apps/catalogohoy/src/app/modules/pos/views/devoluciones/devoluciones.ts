import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EcommerceConfigStore,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { Order, OrderItem } from '@catalogohoy/order';
import { TenantStore } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { PosCajaStore } from '../../pos-caja.store';
import { PosService } from '../../pos.service';

/** Una línea de la venta con la cantidad elegida a devolver. */
interface ReturnLine {
  item: OrderItem;
  label: string;
  maxQty: number;
  qty: number;
}

/**
 * Devoluciones del Punto de Venta: buscar una venta (por #número o cliente),
 * elegir qué ítems y cuántos devolver, y procesar: repone stock (opcional) y
 * registra una orden negativa que resta del neto y — si hay caja abierta y el
 * reembolso es en efectivo — descuenta del arqueo.
 */
@Component({
  selector: 'pos-devoluciones',
  standalone: true,
  imports: [DatePipe, FormsModule, IconComponent, TranslocoPipe],
  templateUrl: './devoluciones.html',
  styleUrl: './devoluciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosDevoluciones implements OnInit {
  private readonly posService = inject(PosService);
  readonly caja = inject(PosCajaStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly toast = inject(ToastService);

  private tenantId: number | null = null;

  readonly cs = computed(
    () =>
      this.tenantCurrency.displaySymbol() ||
      this.configStore.config()?.currencySymbol ||
      '$'
  );

  // Búsqueda
  readonly search = signal('');
  readonly results = signal<Order[]>([]);
  readonly isSearching = signal(false);

  // Venta seleccionada + líneas a devolver
  readonly selected = signal<Order | null>(null);
  readonly lines = signal<ReturnLine[]>([]);
  readonly restock = signal(true);
  readonly reason = signal('');
  readonly isWorking = signal(false);

  /** Total a reembolsar según las cantidades elegidas. */
  readonly refundTotal = computed(() =>
    this.lines().reduce((s, l) => s + l.item.price * l.qty, 0)
  );
  readonly hasSelection = computed(() => this.lines().some((l) => l.qty > 0));

  ngOnInit(): void {
    this.caja.loadOpenSession();
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (!tid) return;
      this.tenantId = tid;
      this.tenantCurrency.load(tid);
      this.configStore.loadConfig(String(tid));
      this.runSearch();
    });
  }

  money(n: number | null | undefined): string {
    return `${this.cs()}${(n ?? 0).toFixed(2)}`;
  }

  async runSearch(): Promise<void> {
    if (!this.tenantId) return;
    this.isSearching.set(true);
    const res = await this.posService.findPosOrders(
      this.tenantId,
      this.search().trim(),
      30
    );
    this.isSearching.set(false);
    res.fold(
      (error) => this.toast.error(new Exception(error.message)),
      (orders) => this.results.set(orders)
    );
  }

  private itemLabel(it: OrderItem): string {
    const extra = it.variantName || it.size;
    return extra ? `${it.name} · ${extra}` : it.name;
  }

  selectOrder(order: Order): void {
    this.selected.set(order);
    this.lines.set(
      (order.products ?? []).map((item) => ({
        item,
        label: this.itemLabel(item),
        maxQty: Math.abs(item.quantity ?? 1),
        qty: Math.abs(item.quantity ?? 1),
      }))
    );
    this.restock.set(true);
    this.reason.set('');
  }

  clearSelection(): void {
    this.selected.set(null);
    this.lines.set([]);
  }

  incLine(i: number): void {
    this.lines.update((ls) =>
      ls.map((l, idx) =>
        idx === i ? { ...l, qty: Math.min(l.maxQty, l.qty + 1) } : l
      )
    );
  }

  decLine(i: number): void {
    this.lines.update((ls) =>
      ls.map((l, idx) => (idx === i ? { ...l, qty: Math.max(0, l.qty - 1) } : l))
    );
  }

  async process(): Promise<void> {
    const order = this.selected();
    if (!order || !this.tenantId || this.isWorking()) return;
    if (!this.hasSelection()) {
      this.toast.error(new Exception('Elegí al menos un ítem a devolver.'));
      return;
    }
    // Ítems a devolver con la cantidad elegida (y su total proporcional).
    const items: OrderItem[] = this.lines()
      .filter((l) => l.qty > 0)
      .map((l) => ({
        ...l.item,
        quantity: l.qty,
        total: l.item.price * l.qty,
      }));

    this.isWorking.set(true);
    const res = await this.posService.processReturn(this.tenantId, order, items, {
      restock: this.restock(),
      paymentMethod: order.paymentMethod ?? null,
      sessionId: this.caja.openSessionId(),
      reason: this.reason().trim() || null,
    });
    this.isWorking.set(false);
    res.fold(
      (error) => this.toast.error(new Exception(error.message)),
      () => {
        this.toast.success(`Devolución procesada · ${this.money(this.refundTotal())}`);
        if (this.caja.hasOpenSession()) this.caja.refresh();
        this.clearSelection();
        this.runSearch();
      }
    );
  }
}

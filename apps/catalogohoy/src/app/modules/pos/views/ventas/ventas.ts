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
import { IconComponent, ToddComponent } from '@ui';
import { PosService } from '../../pos.service';

/** Ventas de un mismo día, con su neto (ventas − devoluciones). */
interface SalesDay {
  day: string;
  date: string;
  orders: Order[];
  total: number;
}

/**
 * Historial de ventas del Punto de Venta (CAT-95): lista los tickets cobrados
 * (y las devoluciones) agrupados por día; al tocar uno se ve qué se vendió, a
 * qué cliente, con qué medio de pago y por cuánto.
 */
@Component({
  selector: 'pos-ventas',
  standalone: true,
  imports: [ToddComponent, DatePipe, FormsModule, IconComponent, TranslocoPipe],
  templateUrl: './ventas.html',
  styleUrl: './ventas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosVentas implements OnInit {
  private readonly posService = inject(PosService);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly toast = inject(ToastService);

  private tenantId: number | null = null;
  readonly Math = Math;

  readonly cs = computed(
    () =>
      this.tenantCurrency.displaySymbol() ||
      this.configStore.config()?.currencySymbol ||
      '$'
  );

  readonly search = signal('');
  readonly orders = signal<Order[]>([]);
  readonly isLoading = signal(false);
  readonly selected = signal<Order | null>(null);

  readonly days = computed<SalesDay[]>(() => {
    const byDay = new Map<string, SalesDay>();
    for (const o of this.orders()) {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let g = byDay.get(key);
      if (!g) {
        g = { day: key, date: o.createdAt, orders: [], total: 0 };
        byDay.set(key, g);
      }
      g.orders.push(o);
      g.total += o.totalUsd ?? 0;
    }
    return [...byDay.values()];
  });

  ngOnInit(): void {
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (!tid) return;
      this.tenantId = tid;
      this.tenantCurrency.load(tid);
      this.configStore.loadConfig(String(tid));
      this.runSearch();
    });
  }

  money(n: number | null | undefined): string {
    const v = n ?? 0;
    return `${v < 0 ? '-' : ''}${this.cs()}${Math.abs(v).toFixed(2)}`;
  }

  isReturn(o: Order): boolean {
    return (o.totalUsd ?? 0) < 0;
  }

  itemLabel(it: OrderItem): string {
    const extra = [it.variantName, it.size].filter(Boolean).join(' · ');
    return extra ? `${it.name} · ${extra}` : it.name;
  }

  itemsSummary(o: Order): string {
    const items = o.products ?? [];
    const first = items
      .slice(0, 2)
      .map((it) => `${Math.abs(it.quantity ?? 1)}× ${it.name}`)
      .join(', ');
    return items.length > 2 ? `${first} +${items.length - 2}` : first;
  }

  async runSearch(): Promise<void> {
    if (!this.tenantId) return;
    this.isLoading.set(true);
    const res = await this.posService.findPosOrders(
      this.tenantId,
      this.search().trim(),
      100,
      { includeReturns: true }
    );
    this.isLoading.set(false);
    res.fold(
      (error) => this.toast.error(new Exception(error.message)),
      (orders) => this.orders.set(orders)
    );
  }

  open(o: Order): void {
    this.selected.set(o);
  }

  close(): void {
    this.selected.set(null);
  }
}

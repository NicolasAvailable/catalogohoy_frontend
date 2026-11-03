import {
  CdkDragDrop,
  DragDropModule,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { DialogService, IconComponent, ImageComponent } from '@ui';
import { Order } from '../../../domain/order';
import { OrderStatusDef, resolveStatusKey } from '../../../domain/order-stage';
import { OrderStageStore } from '../../../infrastructure/order-stage.store';
import { OrderService } from '../../../infrastructure/order.service';
import { OrderStore } from '../../../infrastructure/order.store';
import { openOrderStagesEditor } from '../order-stages-modal/order-stages-modal';

type BoardColumn = {
  def: OrderStatusDef;
  orders: Order[];
  total: number;
  page: number;
  loading: boolean;
};

const PAGE_SIZE = 30;

/** Vista tablero de Órdenes: una columna por estado visible de la tienda y
 *  las órdenes como tarjetas que se arrastran de una columna a otra. */
@Component({
  selector: 'lib-order-board',
  standalone: true,
  imports: [
    DragDropModule,
    DatePipe,
    DecimalPipe,
    TranslocoPipe,
    IconComponent,
    ImageComponent,
  ],
  templateUrl: './order-board.html',
  host: { class: 'flex-1 flex flex-col min-h-0' },
})
export class OrderBoardComponent {
  private readonly stageStore = inject(OrderStageStore);
  private readonly orderService = inject(OrderService);
  private readonly orderStore = inject(OrderStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly toast = inject(ToastService);
  private readonly dialogService = inject(DialogService);

  public readonly search = input<string>('');
  public readonly date = input<Date | null>(null);
  public readonly currencySymbol = input<string>('$');
  public readonly canEdit = input<boolean>(false);
  public readonly openOrder = output<Order>();

  public readonly columns = signal<BoardColumn[]>([]);
  /** Ya se sabe qué columnas hay (estados de la tienda cargados). */
  public readonly stagesReady = computed(
    () => this.stageStore.loadedTenantId() !== null
  );
  /** Forma del esqueleto inicial: columnas con distinta cantidad de tarjetas. */
  public readonly skeletonColumns = [[1, 2, 3], [1, 2], [1, 2, 3], [1], [1, 2]];
  public readonly movingId = signal<number | null>(null);
  private loadSeq = 0;

  constructor() {
    effect(() => {
      const defs = this.stageStore.visibleDefs();
      this.search();
      this.date();
      if (!this.stagesReady()) return;
      untracked(() => this.loadAll(defs));
    });
  }

  /** "Nueva columna": crea un estado; al guardarse el tablero se recarga solo
   *  (cambian los estados visibles). */
  createColumn() {
    openOrderStagesEditor(this.dialogService, true);
  }

  /** Recarga todas las columnas (ej. al cerrar el detalle de una orden). */
  reload() {
    this.loadAll(this.stageStore.visibleDefs());
  }

  private async loadAll(defs: OrderStatusDef[]) {
    const seq = ++this.loadSeq;
    const previous = new Map(this.columns().map((c) => [c.def.key, c]));
    this.columns.set(
      defs.map((def) => ({
        def,
        orders: previous.get(def.key)?.orders ?? [],
        total: previous.get(def.key)?.total ?? 0,
        page: 1,
        loading: true,
      }))
    );
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId || seq !== this.loadSeq) return;
    // Todas las columnas aparecen juntas: se esperan todas y se pintan a la vez.
    const pages = await Promise.all(defs.map((def) => this.fetch(tenantId, def, 1)));
    if (seq !== this.loadSeq) return;
    const byKey = new Map(defs.map((def, i) => [def.key, pages[i]]));
    this.columns.update((cols) =>
      cols.map((c) => {
        const page = byKey.get(c.def.key);
        return {
          ...c,
          orders: page?.orders ?? c.orders,
          total: page?.totalCount ?? c.total,
          loading: false,
        };
      })
    );
  }

  async loadMore(column: BoardColumn) {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId || column.loading) return;
    const nextPage = column.page + 1;
    this.patchColumn(column.def.key, (c) => ({ ...c, loading: true }));
    const page = await this.fetch(tenantId, column.def, nextPage);
    this.patchColumn(column.def.key, (c) => {
      const seen = new Set(c.orders.map((o) => o.id));
      const extra = (page?.orders ?? []).filter((o) => !seen.has(o.id));
      return {
        ...c,
        orders: [...c.orders, ...extra],
        total: page?.totalCount ?? c.total,
        page: page ? nextPage : c.page,
        loading: false,
      };
    });
  }

  /** Una columna base muestra solo las órdenes sin estado propio, así cada
   *  orden aparece en una sola columna (sin estados propios no hace falta). */
  private async fetch(tenantId: number, def: OrderStatusDef, page: number) {
    const hasCustom = this.stageStore.defs().some((d) => !d.system);
    // Cada columna termina por su cuenta: un error no deja a las demás cargando.
    try {
      const result = await this.orderService.getOrdersByTenant(tenantId, {
        status: def.baseStatus,
        stageId: def.system ? (hasCustom ? null : undefined) : def.rowId,
        search: this.search() || undefined,
        date: this.date() ?? undefined,
        orderBy: 'date_desc',
        page,
        pageSize: PAGE_SIZE,
      });
      return result.fold(
        () => null,
        (value) => value
      );
    } catch {
      return null;
    }
  }

  private patchColumn(key: string, fn: (c: BoardColumn) => BoardColumn) {
    this.columns.update((cols) =>
      cols.map((c) => (c.def.key === key ? fn(c) : c))
    );
  }

  async drop(event: CdkDragDrop<BoardColumn>) {
    if (event.previousContainer === event.container) return;
    const from = event.previousContainer.data;
    const to = event.container.data;
    const order: Order = event.item.data;
    const target = resolveStatusKey(to.def.key, this.stageStore.defs());
    if (!target || this.movingId()) return;

    // Movimiento optimista: la tarjeta queda donde la soltó mientras se guarda.
    const snapshot = this.columns();
    const fromOrders = [...from.orders];
    const toOrders = [...to.orders];
    transferArrayItem(
      fromOrders,
      toOrders,
      event.previousIndex,
      event.currentIndex
    );
    this.patchColumn(from.def.key, (c) => ({
      ...c,
      orders: fromOrders,
      total: c.total - 1,
    }));
    this.patchColumn(to.def.key, (c) => ({
      ...c,
      orders: toOrders,
      total: c.total + 1,
    }));

    this.movingId.set(order.id);
    const result = await this.orderStore.updateOrderStatus(
      order.id,
      order.status,
      target.status,
      target.stageId
    );
    this.movingId.set(null);
    result.fold(
      (error) => {
        this.columns.set(snapshot);
        this.toast.error(new Exception(error));
      },
      (updated) => {
        this.patchColumn(to.def.key, (c) => ({
          ...c,
          orders: c.orders.map((o) => (o.id === updated.id ? updated : o)),
        }));
        this.toast.success(
          `Orden #${order.orderNumber ?? order.id} → ${to.def.label}`
        );
      }
    );
  }

  itemCount(order: Order): number {
    return order.products.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0),
      0
    );
  }

  itemsSummary(order: Order): string {
    return order.products
      .map((p) => (p.quantity > 1 ? `${p.quantity}× ${p.name}` : p.name))
      .join(', ');
  }

  photos(order: Order): string[] {
    return order.products
      .map((p) => p.photo)
      .filter((p): p is string => !!p)
      .slice(0, 3);
  }
}

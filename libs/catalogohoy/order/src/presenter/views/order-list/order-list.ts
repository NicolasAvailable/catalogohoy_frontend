import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { EcommerceConfigStore, TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  ConfirmDialogService,
  DatepickerComponent,
  DialogService,
  dialogConfig,
  EmptyListComponent,
  IconComponent,
  ImageComponent,
  InputSearchComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
  TabHeader,
  TooltipDirective,
} from '@ui';
import { OrderDetailModal } from '../../components/order-detail-modal/order-detail-modal';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import {
  debounceTime,
  distinctUntilChanged,
  Subject,
  Subscription,
} from 'rxjs';
import { RateStore } from '@catalogohoy/rate';
import {
  effectiveOrderBs,
  Order,
  OrderItem,
  OrderStatus,
} from '../../../domain/order';
import { isVentaFeatureEnabled } from '../../../domain/venta-feature';
import { OrderPdfService } from '../../../infrastructure/order-pdf.service';
import { OrderRealtimeService } from '../../../infrastructure/order-realtime.service';
import { OrderStore } from '../../../infrastructure/order.store';

type FilterTab = {
  label: string;
  value: OrderStatus | 'all';
  /** Tailwind bg color class for the colored dot matching the status badge. */
  dotClass?: string;
};
type OrderBy = 'date_asc' | 'date_desc' | 'total_asc' | 'total_desc';
/** Presets del selector de rango del tab de Métricas. */
type MetricsPreset = 'today' | 'last_7' | 'last_30' | 'last_90' | 'custom';

@Component({
  selector: 'lib-order-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoPipe,
    IconComponent,
    ButtonComponent,
    DatepickerComponent,
    EmptyListComponent,
    InputSearchComponent,
    ImageComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    TooltipDirective,
    PaginatorModule,
    NgApexchartsModule,
  ],
  templateUrl: './order-list.html',
  styleUrl: './order-list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class OrderListComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly dialogService = inject(DialogService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  public readonly orderStore = inject(OrderStore);
  private readonly configStore = inject(EcommerceConfigStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly orderPdf = inject(OrderPdfService);
  private readonly rateStore = inject(RateStore);

  /** Bs a mostrar por orden: pendientes a la tasa ACTUAL, el resto su snapshot.
   *  Ver {@link effectiveOrderBs}. */
  public orderBs(order: Order): number {
    return effectiveOrderBs(order, this.rateStore.rateValue());
  }
  // Primary "Total" column symbol = the catalog's reference/display currency.
  // For Venezuela that's the chosen reference (USD '$' or EUR '€'); for every
  // other country it's the local currency (DOP 'RD$', MXN '$', COP '$'…),
  // because there display == product currency. `order.totalUsd` is always
  // stored in this reference currency.
  public readonly cs = computed(
    () =>
      this.tenantCurrency.displaySymbol() ||
      this.configStore.config()?.currencySymbol ||
      '$'
  );

  // Whether to render the second "Total Bs" column. Gated on the tenant's
  // dual-currency flag (true only for Venezuela-style catalogs), NOT the
  // country code — so a non-VE catalog never shows bolivars.
  public readonly showBs = computed(() => this.tenantCurrency.showDualCurrency());

  /** Moneda de las métricas, según la config del catálogo (mismo criterio que la
   *  factura): si muestra la referencia (USD/EUR o local) → montos en total_usd
   *  con el símbolo de display; si es solo-bolívares (Venezuela con referencia
   *  oculta) → montos en total_bs con "Bs.". */
  protected readonly metricsUseBs = computed(
    () => !(this.configStore.config()?.showReferencePrice ?? true)
  );
  protected readonly metricSymbol = computed(() => {
    if (!this.metricsUseBs()) return this.cs();
    const s = this.tenantCurrency.localSymbol() || 'Bs.';
    return s.endsWith(' ') ? s : s + ' ';
  });
  private readonly orderRealtime = inject(OrderRealtimeService);
  private readonly permissions = inject(TeamPermissionsStore);
  protected readonly canCreateOrder = computed(() => this.permissions.isOwner() || this.permissions.can()('ordenes', 'create'));
  /** "Registrar venta" (venta en tienda) es solo para administradores (owner),
   *  a diferencia de crear orden que también puede un miembro con permiso. */
  protected readonly isAdmin = computed(() => this.permissions.isOwner());
  /** Beta cerrada: la venta en tienda (recibo + evidencia de pago) solo está
   *  habilitada para los tenants del allowlist mientras la validamos. */
  protected readonly ventaFeatureEnabled = computed(() =>
    isVentaFeatureEnabled(this.tenantStore.tenantId())
  );

  // ── Tabs: "Órdenes" (tabla) | "Métricas" (dashboard) ──────────────────────
  protected readonly orderTabs: TabHeader[] = [
    { ref: 'ordenes', label: 'Órdenes' },
    { ref: 'metricas', label: 'Métricas' },
  ];
  protected readonly activeTab = signal<'ordenes' | 'metricas'>('ordenes');

  // ── Métricas (agregados server-side sobre TODAS las órdenes) ──────────────
  protected readonly metrics = this.orderStore.metrics;
  protected readonly isLoadingMetrics = this.orderStore.isLoadingMetrics;
  protected readonly metricsPresets: { key: MetricsPreset; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'last_7', label: '7 días' },
    { key: 'last_30', label: '30 días' },
    { key: 'last_90', label: '90 días' },
    { key: 'custom', label: 'Personalizado' },
  ];
  protected readonly metricsPreset = signal<MetricsPreset>('last_30');
  protected readonly customFrom = signal<Date | null>(null);
  protected readonly customTo = signal<Date | null>(null);

  /** Conteo + monto por estado, resueltos a las 3 categorías que mostramos. */
  protected readonly metricByStatus = computed(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    (this.orderStore.metrics()?.byStatus ?? []).forEach(
      (s) => (map[s.status] = { count: s.count, amount: s.amount })
    );
    const zero = { count: 0, amount: 0 };
    return {
      completed: map['completed'] ?? zero,
      pending: map['pending'] ?? zero,
      credit: map['credit'] ?? zero,
      cancelled: map['cancelled'] ?? zero,
    };
  });

  /** Area chart "Ventas por día" — mismo estilo que los reports (gradiente real
   *  + tokens del proyecto). Se recomputa cuando cambian las métricas/periodo. */
  protected readonly salesAreaOptions = computed<ApexOptions>(() => {
    const byDay = this.orderStore.metrics()?.byDay ?? [];
    const symbol = this.metricSymbol();
    return {
      chart: {
        type: 'area',
        height: 260,
        fontFamily: 'inherit',
        foreColor: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { speed: 400, animateGradually: { enabled: false } },
      },
      colors: ['#6366f1'],
      dataLabels: { enabled: false },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.2,
          opacityFrom: 0.55,
          opacityTo: 0.05,
          stops: [0, 100],
        },
      },
      grid: {
        borderColor: '#eef2ff',
        strokeDashArray: 4,
        padding: { left: 8, right: 8, top: 0, bottom: 0 },
      },
      series: [
        {
          name: 'Ventas',
          data: byDay.map((d) => ({
            x: new Date(d.date).getTime(),
            y: d.amount,
          })),
        },
      ],
      stroke: { curve: 'smooth', width: 3 },
      xaxis: {
        type: 'datetime',
        axisBorder: { show: false },
        axisTicks: { show: false },
        // Sin la línea vertical ni el recuadro de la fecha que se deslizan con
        // el cursor (era lo que "se movía" en el hover).
        crosshairs: { show: false },
        tooltip: { enabled: false },
        labels: {
          style: { colors: '#94a3b8', fontSize: '11px' },
          datetimeFormatter: { day: 'dd MMM' },
        },
      },
      yaxis: {
        labels: {
          style: { colors: '#94a3b8', fontSize: '11px' },
          formatter: (v: number) => `${symbol}${Math.round(v)}`,
        },
      },
      markers: { size: 0, hover: { size: 0, sizeOffset: 0 } },
      // Sin efecto de hover que "mueva" la gráfica (ni marker que aparezca ni
      // filtro de realce sobre la serie).
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } },
      },
    };
  });

  /** Donut "Distribución por estado" (por monto facturado en el periodo). */
  protected readonly statusDonutOptions = computed<ApexOptions>(() => {
    const s = this.metricByStatus();
    const symbol = this.metricSymbol();
    const total =
      s.completed.amount +
      s.pending.amount +
      s.credit.amount +
      s.cancelled.amount;
    return {
      chart: {
        type: 'donut',
        height: 260,
        fontFamily: 'inherit',
        foreColor: 'inherit',
      },
      labels: ['Completadas', 'Pendientes', 'A crédito', 'Canceladas'],
      series: [
        s.completed.amount,
        s.pending.amount,
        s.credit.amount,
        s.cancelled.amount,
      ],
      colors: ['#22c55e', '#f97316', '#3b82f6', '#ef4444'],
      stroke: { width: 0 },
      dataLabels: { enabled: false },
      legend: { position: 'bottom', fontSize: '13px' },
      plotOptions: {
        pie: {
          expandOnClick: false,
          donut: {
            size: '70%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total',
                formatter: () => `${symbol}${total.toFixed(2)}`,
              },
            },
          },
        },
      },
      // Sin realce/expansión de los segmentos al pasar el mouse.
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } },
      },
    };
  });
  protected readonly canEditOrder = computed(() => this.permissions.isOwner() || this.permissions.can()('ordenes', 'edit'));
  protected readonly canDeleteOrder = computed(() => this.permissions.isOwner() || this.permissions.can()('ordenes', 'delete'));

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  public readonly searchQuery = signal('');
  public readonly selectedFilter = signal<OrderStatus | 'all'>('all');
  public readonly selectedOrder = signal<OrderBy>('date_desc');
  public readonly selectedDate = signal<Date | null>(null);
  public readonly isProcessing = signal(false);
  public readonly mobileShowAll = signal(false);

  /** How many product lines to show before collapsing the products cell. */
  public readonly PRODUCTS_PREVIEW = 3;
  /** Order ids whose products cell is expanded ("Ver más"). */
  private readonly expandedProducts = signal<Set<number>>(new Set());

  public isProductsExpanded(orderId: number): boolean {
    return this.expandedProducts().has(orderId);
  }

  public toggleProductsExpanded(orderId: number): void {
    const next = new Set(this.expandedProducts());
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    this.expandedProducts.set(next);
  }

  public visibleProducts(order: Order): OrderItem[] {
    if (this.isProductsExpanded(order.id)) return order.products;
    return order.products.slice(0, this.PRODUCTS_PREVIEW);
  }
  // Pagination state — desktop table only (mobile keeps the "show all" toggle)
  public readonly pageFirst = signal(0);
  public readonly pageRows = signal(10);

  public readonly filterTabs: FilterTab[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Pendientes', value: 'pending', dotClass: 'bg-orange-500' },
    { label: 'Completadas', value: 'completed', dotClass: 'bg-green-500' },
    { label: 'A crédito', value: 'credit', dotClass: 'bg-blue-500' },
    { label: 'Canceladas', value: 'cancelled', dotClass: 'bg-red-500' },
  ];

  public readonly statusOptions: {
    label: string;
    value: OrderStatus;
  }[] = [
    { label: 'Pendiente', value: 'pending' },
    { label: 'Completada', value: 'completed' },
    { label: 'A crédito', value: 'credit' },
    { label: 'Cancelada', value: 'cancelled' },
  ];

  public readonly orderOptions: {
    label: string;
    value: OrderBy;
    icon: string;
  }[] = [
    { label: 'Más nuevas', value: 'date_desc', icon: 'arrow-down' },
    { label: 'Más viejas', value: 'date_asc', icon: 'arrow-up' },
    { label: 'Total más alto', value: 'total_desc', icon: 'trending-up' },
    { label: 'Total más bajo', value: 'total_asc', icon: 'trending-down' },
  ];

  /** Server-side already filters + sorts + paginates, so this is just
   *  whatever the store currently has. Kept as a computed for readability. */
  public readonly filteredOrders = computed(() => this.orderStore.orderList().items);

  public readonly mobileOrders = computed(() => {
    const orders = this.filteredOrders();
    return this.mobileShowAll() ? orders : orders.slice(0, 5);
  });

  /** Desktop table — pagination is server-side, so the page contains
   *  exactly what the backend returned, just filtered by status locally. */
  public readonly paginatedOrders = computed(() => this.filteredOrders());

  public onPageChange(event: PaginatorState) {
    this.pageFirst.set(event.first ?? 0);
    this.pageRows.set(event.rows ?? 10);
    this.reloadOrders();
  }

  async ngOnInit() {
    // Prime the tenant currency cache (localStorage → DB fallback).
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) this.tenantCurrency.load(tenantId);
    // Tasa activa: para mostrar el Bs de los pedidos pendientes a la tasa de hoy.
    this.rateStore.loadRates();

    // Setup debounced search
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.pageFirst.set(0);
        this.reloadOrders();
      });

    // Initial load pulls just the first page — no more full-table download.
    this.reloadOrders();
    // Grand total (unfiltered) for the footer label.
    this.orderStore.loadGrandTotalCount();
    this.orderRealtime.subscribe();

    // Deep-link: ?order=ID abre el modal de detalle (botón "Ver pedido" de
    // las notificaciones WhatsApp, o al recargar con el modal abierto). El
    // query param se mantiene mientras el modal está abierto y se limpia al
    // cerrarlo (ver openOrderDetail).
    const deepLinkOrderId = this.activatedRoute.snapshot.queryParamMap.get('order');
    if (deepLinkOrderId) {
      this.openDeepLinkOrder(Number(deepLinkOrderId));
    }
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
    this.orderRealtime.unsubscribe();
  }

  openOrderDetail(order: Order) {
    // Reflect the open modal in the URL (?order=ID) so a reload reopens it.
    this.setOrderParam(order.id);
    const ref = this.dialogService.open(
      OrderDetailModal,
      dialogConfig({
        data: {
          order,
          currencySymbol: this.cs(),
          showDualBs: this.tenantCurrency.showDualCurrency(),
        },
        showHeader: false,
        style: { width: '72rem', maxWidth: '95vw' },
        contentStyle: { padding: '0', overflow: 'hidden' },
      })
    );
    ref?.onClose.subscribe(() => this.clearOrderParam());
  }

  private setOrderParam(orderId: number): void {
    this.router.navigate([], {
      queryParams: { order: orderId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private clearOrderParam(): void {
    if (!this.activatedRoute.snapshot.queryParamMap.has('order')) return;
    this.router.navigate([], {
      queryParams: { order: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async openDeepLinkOrder(orderId: number): Promise<void> {
    const order = await this.orderStore.getOrderById(orderId);
    if (order) this.openOrderDetail(order);
  }

  onCreateOrder() {
    this.router.navigate(['/admin/orders/create']);
  }

  /** Venta en tienda: abre el alta de orden en modo "Registrar venta" (nace
   *  completada → genera recibo/nota de entrega y descuenta stock). */
  onRegisterSale() {
    this.router.navigate(['/admin/orders/create-venta']);
  }

  // ── Métricas ──────────────────────────────────────────────────────────────
  onTabChange(ref: string | number | undefined) {
    const tab = ref === 'metricas' ? 'metricas' : 'ordenes';
    this.activeTab.set(tab);
    // Cargar (o refrescar) al entrar al tab de métricas: el RPC es barato y así
    // los números reflejan cualquier orden creada desde que se abrió la vista.
    if (tab === 'metricas') this.loadMetrics();
  }

  setMetricsPreset(preset: MetricsPreset) {
    this.metricsPreset.set(preset);
    if (preset !== 'custom') {
      this.customFrom.set(null);
      this.customTo.set(null);
      this.loadMetrics();
    }
  }

  onCustomFrom(d: Date | null) {
    this.customFrom.set(d);
    this.loadMetrics();
  }

  onCustomTo(d: Date | null) {
    this.customTo.set(d);
    this.loadMetrics();
  }

  private loadMetrics() {
    const range = this.buildMetricsRange();
    if (!range) return;
    this.orderStore.loadOrderMetrics(range);
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private addDays(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  /** [start, end) + todayStart como ISO, calculados en la zona horaria local
   *  del admin (mismo criterio que "Ventas hoy" del código anterior). */
  private buildMetricsRange():
    | { start: string; end: string; todayStart: string; useBs: boolean }
    | null {
    const today = this.startOfDay(new Date());
    const todayStart = today.toISOString();
    let start: Date;
    let end = this.addDays(today, 1); // exclusivo: arranque de mañana

    switch (this.metricsPreset()) {
      case 'today':
        start = today;
        break;
      case 'last_7':
        start = this.addDays(today, -6);
        break;
      case 'last_30':
        start = this.addDays(today, -29);
        break;
      case 'last_90':
        start = this.addDays(today, -89);
        break;
      case 'custom': {
        const from = this.customFrom();
        const to = this.customTo();
        if (!from || !to) return null; // esperar a que elija ambas fechas
        start = this.startOfDay(from);
        end = this.addDays(this.startOfDay(to), 1);
        break;
      }
      default:
        start = this.addDays(today, -29);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      todayStart,
      useBs: this.metricsUseBs(),
    };
  }

  onEditOrder(order: Order) {
    this.router.navigate(['/admin/orders/edit', order.id]);
  }

  selectFilter(filter: OrderStatus | 'all') {
    this.selectedFilter.set(filter);
    this.pageFirst.set(0);
    this.reloadOrders();
  }

  setOrder(order: OrderBy) {
    this.selectedOrder.set(order);
    this.pageFirst.set(0);
    this.reloadOrders();
  }

  reloadOrders() {
    const date = this.selectedDate() ?? undefined;
    const search = this.searchQuery() || undefined;
    const status = this.selectedFilter();
    const orderBy = this.selectedOrder();
    const pageSize = this.pageRows();
    const page = Math.floor(this.pageFirst() / pageSize) + 1;
    this.orderStore.loadOrders({ date, search, status, orderBy, page, pageSize });
  }

  onDateChange(date: Date | null) {
    this.selectedDate.set(date);
    this.pageFirst.set(0);
    this.reloadOrders();
  }

  onSearch(query: string) {
    this.searchSubject.next(query);
  }

  getStatusSeverity(
    status: string
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warn';
      case 'credit':
        return 'info';
      default:
        return 'secondary';
    }
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      completed: 'Completada',
      credit: 'A crédito',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(_status: OrderStatus): string {
    return 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-grey-100 text-grey-700';
  }

  getStatusDotClass(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      pending: 'bg-orange-400',
      completed: 'bg-green-500',
      credit: 'bg-blue-500',
      cancelled: 'bg-red-500',
    };
    return `w-2 h-2 rounded-full shrink-0 ${colors[status] ?? 'bg-grey-400'}`;
  }

  getPaymentMethod(order: Order): string {
    // This could be expanded based on actual payment data
    const methods = ['WhatsApp', 'Efectivo', 'Zelle', 'Pago Móvil'];
    return methods[order.id % methods.length];
  }

  getPaymentIcon(order: Order): string {
    const method = this.getPaymentMethod(order);
    const icons: Record<string, string> = {
      WhatsApp: 'message-circle',
      Efectivo: 'banknote',
      Zelle: 'wallet',
      'Pago Móvil': 'smartphone',
    };
    return icons[method] || 'credit-card';
  }

  getPaymentColor(order: Order): string {
    const method = this.getPaymentMethod(order);
    const colors: Record<string, string> = {
      WhatsApp: 'text-green-500',
      Efectivo: 'text-blue-500',
      Zelle: 'text-emerald-500',
      'Pago Móvil': 'text-purple-500',
    };
    return colors[method] || 'text-grey-500';
  }

  getWhatsAppLink(phone: string): string {
    // Remove all non-numeric characters except +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleanPhone}`;
  }

  async onStatusChange(order: Order, newStatus: OrderStatus) {
    if (newStatus === order.status || this.isProcessing()) return;

    this.isProcessing.set(true);
    const result = await this.orderStore.updateOrderStatus(
      order.id,
      order.status,
      newStatus
    );
    result.fold(
      (error) => this.toastService.error(new Exception(error)),
      () => {
        const label = this.getStatusLabel(newStatus);
        this.toastService.success(`Estado actualizado a "${label}"`);
      }
    );
    this.isProcessing.set(false);
  }

  getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      tarjeta_credito: 'Tarjeta de crédito',
      pago_movil: 'Pago móvil',
      binance: 'Binance',
      zelle: 'Zelle',
      paypal: 'PayPal',
    };
    return labels[method] || method;
  }

  onDeleteOrder(order: Order) {
    if (this.isProcessing()) return;

    this.confirmDialogService
      .warning({
        headerLabel: '¿Eliminar orden?',
        contentLabel: `¿Estás seguro de que deseas eliminar la orden de "${order.name}"? Esta acción no se puede deshacer.`,
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        result.fold(
          () => {
            // Usuario canceló
          },
          async () => {
            // Usuario confirmó
            this.isProcessing.set(true);
            const deleteResult = await this.orderStore.deleteOrder(order.id);
            deleteResult.fold(
              (error) => {
                this.toastService.error(new Exception(error));
              },
              () => {
                this.toastService.success('Orden eliminada correctamente');
                // Refresh both the current page (in case the page shrank to
                // fewer rows than pageSize and we can backfill from the next
                // page) and the grand total footer label.
                this.reloadOrders();
                this.orderStore.loadGrandTotalCount();
              }
            );
            this.isProcessing.set(false);
          }
        );
      });
  }

  downloadPdf(order: Order): void {
    // Pendientes: el recibo se emite a la tasa ACTUAL (mismo criterio que el
    // listado/detalle). El PDF deriva el rate de totalBs/totalUsd, así que le
    // pasamos el Bs efectivo; el resto de estados usa su snapshot congelado.
    this.orderPdf.download({ ...order, totalBs: this.orderBs(order) });
  }
}

import { DecimalPipe } from '@angular/common';
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
import {
  Order,
  OrderItem,
  OrderItemAddon,
  OrderStatus,
  OrderStore,
} from '@catalogohoy/order';
import {
  Product,
  ProductSize,
  ProductStore,
  ProductVariant,
} from '@catalogohoy/product';
import { RateStore } from '@catalogohoy/rate';
import { TenantStore } from '@catalogohoy/tenant';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { PosCartStore } from '../../pos-cart.store';
import { PosCajaStore } from '../../pos-caja.store';
import { PosSettingsStore } from '../../pos-settings.store';
import { PosScanner } from '../../components/scanner/scanner';

/** Un medio de pago ofrecido en el modal de cobro. */
interface PayMethod {
  label: string;
  icon: string;
  /** Ajuste % sobre el total con este medio (config del POS): + recargo,
   *  − descuento, 0 sin ajuste. */
  adjust: number;
}

/** Snapshot de una venta cobrada, para el comprobante (se arma antes de vaciar
 *  el carrito). */
interface PosSaleReceipt {
  number: number | null;
  dateStr: string;
  customer: string;
  phone: string;
  lines: { label: string; qty: number; total: number }[];
  subtotal: number;
  discount: number;
  /** Envío agregado a la venta. 0 = sin envío. */
  shipping: number;
  /** Ajuste del medio de pago (recargo + / descuento −). 0 = sin ajuste. */
  adjustAmount: number;
  total: number;
  method: string;
  received: number | null;
  change: number;
}

@Component({
  selector: 'pos-venta',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    IconComponent,
    PosScanner,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './venta.html',
  styleUrl: './venta.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosVenta implements OnInit {
  readonly productStore = inject(ProductStore);
  readonly cart = inject(PosCartStore);
  readonly caja = inject(PosCajaStore);
  private readonly settings = inject(PosSettingsStore);
  private readonly orderStore = inject(OrderStore);
  private readonly rateStore = inject(RateStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly toast = inject(ToastService);

  private static readonly DEFAULT_METHODS: PayMethod[] = [
    { label: 'Efectivo', icon: 'banknote', adjust: 0 },
    { label: 'Tarjeta', icon: 'credit-card', adjust: 0 },
    { label: 'Transferencia', icon: 'wallet', adjust: 0 },
    { label: 'Pago móvil', icon: 'smartphone', adjust: 0 },
  ];

  // ── UI state ────────────────────────────────────────────────────────────
  readonly search = signal('');
  readonly showScanner = signal(false);
  /** Producto cuyas variantes/tallas/adicionales se están eligiendo. */
  readonly optionsProduct = signal<Product | null>(null);
  /** Cantidades de adicionales elegidas en el modal (addonId → cantidad). */
  readonly addonSelection = signal<Record<string, number>>({});
  readonly showCobrar = signal(false);
  readonly amountReceived = signal<number | null>(null);
  readonly isCharging = signal(false);
  /** Pantalla de éxito con el comprobante, tras cobrar. */
  readonly showSuccess = signal(false);
  readonly lastSale = signal<PosSaleReceipt | null>(null);
  // Acciones rápidas (mini-modales)
  readonly showCustomer = signal(false);
  readonly showNote = signal(false);
  readonly showDiscount = signal(false);
  readonly showCreateProduct = signal(false);
  readonly customerNameDraft = signal('');
  readonly customerPhoneDraft = signal('');
  readonly noteDraft = signal('');
  readonly discountDraft = signal(0);
  readonly newProductName = signal('');
  readonly newProductPrice = signal<number | null>(null);
  /** Modal de búsqueda del catálogo (estilo TiendaNube: "Buscar productos"). */
  readonly showProductSearch = signal(false);
  /** Envío agregado a la venta (monto). */
  readonly showShipping = signal(false);
  readonly shippingDraft = signal<number | null>(null);
  readonly shipping = signal(0);

  /** Símbolo de la moneda de referencia del catálogo (igual que el checkout). */
  readonly cs = computed(
    () =>
      this.tenantCurrency.displaySymbol() ||
      this.configStore.config()?.currencySymbol ||
      '$'
  );

  /** Tasa activa (solo relevante para VE; 0 en el resto → totalBs 0). */
  private readonly exchangeRate = computed(() => {
    const rate = this.rateStore.rate();
    if (!rate) return 0;
    const map: Record<string, number> = {
      bcv_usd: rate.bcv_usd ?? 0,
      bcv_eur: rate.bcv_eur ?? 0,
      custom: rate.custom_rate ?? 0,
    };
    return map[rate.active_rate] ?? 0;
  });

  /** Productos vendibles filtrados por el buscador (nombre/descr/SKU, también
   *  el SKU de variantes y tallas). Se ocultan los productos ocultos. */
  readonly products = computed<Product[]>(() => {
    const q = this.search().trim().toLowerCase();
    const all = this.productStore
      .productList()
      .products.filter((p) => !p.isHidden);
    if (!q) return all;
    return all.filter((p) => this.matchesQuery(p, q));
  });

  /** Medios de pago del modal de cobro: primero los habilitados en la
   *  Configuración del POS; si no, los ACTIVOS del catálogo; y como último
   *  recurso, un set por defecto. */
  readonly payMethods = computed<PayMethod[]>(() => {
    const configured = this.settings
      .enabledMethods()
      .map((m) => ({ label: m.label, icon: m.icon, adjust: m.adjustPercent }));
    if (configured.length) return configured;
    const active = this.configStore
      .paymentMethodsList()
      .filter((m) => m.isActive)
      .map((m) => ({ label: m.name, icon: this.iconForMethod(m.name), adjust: 0 }));
    return active.length ? active : PosVenta.DEFAULT_METHODS;
  });

  /** Ajuste % del medio de pago elegido (recargo/descuento configurado). */
  readonly selectedAdjust = computed(() => {
    const label = this.cart.paymentMethod();
    return this.payMethods().find((m) => m.label === label)?.adjust ?? 0;
  });

  /** Monto del ajuste del medio de pago sobre el total del carrito. */
  readonly adjustAmount = computed(
    () => (this.cart.total() * this.selectedAdjust()) / 100
  );

  /** Total del carrito con envío (antes del ajuste del medio de pago) — para
   *  el botón Cobrar y el subtotal del panel. */
  readonly displayTotal = computed(() => this.cart.total() + this.shipping());

  /** Total REAL a cobrar = carrito + envío ± ajuste del medio de pago. */
  readonly chargeTotal = computed(() =>
    Math.max(0, this.cart.total() + this.shipping() + this.adjustAmount())
  );

  /** El medio elegido es efectivo → mostramos el campo "recibido" y el vuelto. */
  readonly isCash = computed(() =>
    /efectivo|cash|contado/i.test(this.cart.paymentMethod())
  );

  /** Vuelto = recibido − total a cobrar (nunca negativo). */
  readonly change = computed(() => {
    const r = this.amountReceived();
    if (r == null) return 0;
    return Math.max(0, r - this.chargeTotal());
  });

  /** Qué elige el modal de opciones para el producto activo. */
  readonly optionsMode = computed<'variant' | 'size' | 'addons' | null>(() => {
    const p = this.optionsProduct();
    if (!p) return null;
    if (p.isVariant && p.variants?.length) return 'variant';
    if (p.isSized && p.sizes?.length) return 'size';
    if (p.addons?.length) return 'addons';
    return null;
  });

  ngOnInit(): void {
    this.productStore.productList$();
    this.rateStore.loadRates();
    this.tenantStore.getTenantIdAsync().then((tid) => {
      this.settings.load(tid ? String(tid) : 'default');
      if (!tid) return;
      this.tenantCurrency.load(tid);
      this.configStore.loadPaymentMethods(String(tid));
      this.configStore.loadConfig(String(tid));
    });
  }

  // ── Búsqueda / matching ──────────────────────────────────────────────────
  private matchesQuery(p: Product, q: string): boolean {
    if (p.name?.toLowerCase().includes(q)) return true;
    if (p.description?.toLowerCase().includes(q)) return true;
    if (p.sku?.toLowerCase().includes(q)) return true;
    if (p.sizes?.some((s) => s.sku?.toLowerCase().includes(q))) return true;
    if (p.variants?.some((v) => v.sku?.toLowerCase().includes(q))) return true;
    return false;
  }

  // ── Precio / stock ─────────────────────────────────────────────────────────
  /** Unitario base del producto: primer tramo si es al mayor, si no promo/precio. */
  unitPrice(p: Product): number {
    if (p.isWholesale && p.wholesaleTiers?.length) {
      return p.wholesaleTiers[0].price;
    }
    return p.pricePromotional > 0 ? p.pricePromotional : p.price;
  }

  /** Stock del producto simple como número (null = sin control / ilimitado). */
  stockNum(p: Product): number | null {
    if (p.stock == null || p.stock === '') return null;
    const n = Number(p.stock);
    return Number.isFinite(n) ? n : null;
  }

  // ── Agregar al carrito ─────────────────────────────────────────────────────
  onProductClick(p: Product): void {
    if (p.isVariant && p.variants?.length) {
      this.optionsProduct.set(p);
      return;
    }
    if (p.isSized && p.sizes?.length) {
      this.optionsProduct.set(p);
      return;
    }
    if (p.addons?.length) {
      this.addonSelection.set({});
      this.optionsProduct.set(p);
      return;
    }
    this.addSimple(p);
  }

  addSimple(p: Product): void {
    const price = this.unitPrice(p);
    this.cart.addLine({
      productId: p.id,
      name: p.name,
      price,
      photo: p.photos?.[0],
      sku: p.sku,
      available: this.stockNum(p),
      tierTitle:
        p.isWholesale && p.wholesaleTiers?.length
          ? p.wholesaleTiers[0].title
          : null,
    });
    this.toast.success(`${p.name} agregado`);
  }

  addVariant(p: Product, v: ProductVariant): void {
    const price = v.price > 0 ? v.price : this.unitPrice(p);
    this.cart.addLine({
      productId: p.id,
      name: p.name,
      price,
      photo: v.photos?.[0] ?? p.photos?.[0],
      sku: v.sku ?? p.sku,
      variantId: v.id,
      variantName: v.name,
      available: v.stock,
    });
    this.optionsProduct.set(null);
    this.toast.success(`${p.name} · ${v.name} agregado`);
  }

  addSize(p: Product, s: ProductSize): void {
    this.cart.addLine({
      productId: p.id,
      name: p.name,
      price: this.unitPrice(p),
      photo: p.photos?.[0],
      sku: s.sku ?? p.sku,
      size: s.name,
      available: s.stock,
    });
    this.optionsProduct.set(null);
    this.toast.success(`${p.name} · ${s.name} agregado`);
  }

  // ── Adicionales ─────────────────────────────────────────────────────────
  addonQty(id: string): number {
    return this.addonSelection()[id] ?? 0;
  }

  incAddon(id: string): void {
    this.addonSelection.update((sel) => ({ ...sel, [id]: (sel[id] ?? 0) + 1 }));
  }

  decAddon(id: string): void {
    this.addonSelection.update((sel) => {
      const q = (sel[id] ?? 0) - 1;
      const next = { ...sel };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }

  /** Total del combo actual: unitario base del producto + Σ adicionales. */
  addonsRunningTotal(p: Product): number {
    const sel = this.addonSelection();
    const add = (p.addons ?? []).reduce(
      (s, a) => s + a.price * (sel[a.id] ?? 0),
      0
    );
    return this.unitPrice(p) + add;
  }

  /** Agrega el producto con los adicionales elegidos (el unitario ya los suma). */
  confirmAddons(p: Product): void {
    const sel = this.addonSelection();
    const chosen: OrderItemAddon[] = (p.addons ?? [])
      .filter((a) => (sel[a.id] ?? 0) > 0)
      .map((a) => ({ id: a.id, name: a.name, price: a.price, quantity: sel[a.id] }));
    this.cart.addLine({
      productId: p.id,
      name: p.name,
      price: this.addonsRunningTotal(p),
      photo: p.photos[0],
      sku: p.sku,
      available: this.stockNum(p),
      addons: chosen.length ? chosen : null,
    });
    this.optionsProduct.set(null);
    this.toast.success(`${p.name} agregado`);
  }

  closeOptions(): void {
    this.optionsProduct.set(null);
  }

  // ── Escáner ────────────────────────────────────────────────────────────────
  openScanner(): void {
    this.showScanner.set(true);
  }

  closeScanner(): void {
    this.showScanner.set(false);
  }

  /** Un código detectado (o SKU ingresado): busca el producto/variante/talla y
   *  lo agrega. Si no matchea, avisa. */
  onScan(code: string): void {
    this.showScanner.set(false);
    const q = code.trim().toLowerCase();
    if (!q) return;
    const all = this.productStore.productList().products;

    // 1) variante por SKU exacto
    for (const p of all) {
      const v = p.variants?.find((x) => x.sku?.toLowerCase() === q);
      if (v) return this.addVariant(p, v);
    }
    // 2) talla por SKU exacto
    for (const p of all) {
      const s = p.sizes?.find((x) => x.sku?.toLowerCase() === q);
      if (s) return this.addSize(p, s);
    }
    // 3) producto por SKU exacto
    const byExact = all.find((p) => p.sku?.toLowerCase() === q);
    if (byExact) return this.onProductClick(byExact);
    // 4) tolerante: contiene el código
    const byLike = all.find((p) => p.sku?.toLowerCase().includes(q));
    if (byLike) return this.onProductClick(byLike);

    this.toast.error(
      `No encontramos un producto con el código "${code}"` as unknown as Exception
    );
  }

  // ── Acciones rápidas ───────────────────────────────────────────────────────
  openCustomer(): void {
    this.customerNameDraft.set(this.cart.customerName());
    this.customerPhoneDraft.set(this.cart.customerPhone());
    this.showCustomer.set(true);
  }

  saveCustomer(): void {
    this.cart.setCustomer(
      this.customerNameDraft().trim(),
      this.customerPhoneDraft().trim()
    );
    this.showCustomer.set(false);
  }

  clearCustomer(): void {
    this.cart.setCustomer('', '');
    this.showCustomer.set(false);
  }

  openNote(): void {
    this.noteDraft.set(this.cart.note());
    this.showNote.set(true);
  }

  saveNote(): void {
    this.cart.setNote(this.noteDraft().trim());
    this.showNote.set(false);
  }

  openDiscount(): void {
    this.discountDraft.set(this.cart.discountPercent());
    this.showDiscount.set(true);
  }

  applyDiscount(pct: number): void {
    this.discountDraft.set(pct);
  }

  saveDiscount(): void {
    this.cart.setDiscountPercent(this.discountDraft());
    this.showDiscount.set(false);
  }

  openCreateProduct(): void {
    this.newProductName.set('');
    this.newProductPrice.set(null);
    this.showCreateProduct.set(true);
  }

  /** Producto "suelto" (no del catálogo): se agrega solo a esta venta. */
  createSimpleProduct(): void {
    const name = this.newProductName().trim();
    const price = this.newProductPrice() ?? 0;
    if (!name || price <= 0) {
      this.toast.error(
        'Poné un nombre y un precio válido' as unknown as Exception
      );
      return;
    }
    this.cart.addLine({
      productId: `__custom__${name}`,
      name,
      price,
      isCustom: true,
    });
    this.showCreateProduct.set(false);
  }

  // ── Buscar en el catálogo (modal) ──────────────────────────────────────────
  openProductSearch(): void {
    this.search.set('');
    this.showProductSearch.set(true);
  }

  closeProductSearch(): void {
    this.showProductSearch.set(false);
  }

  // ── Envío ────────────────────────────────────────────────────────────────
  openShipping(): void {
    this.shippingDraft.set(this.shipping() || null);
    this.showShipping.set(true);
  }

  saveShipping(): void {
    this.shipping.set(Math.max(0, this.shippingDraft() ?? 0));
    this.showShipping.set(false);
  }

  clearShipping(): void {
    this.shipping.set(0);
    this.showShipping.set(false);
  }

  // ── Cobro ────────────────────────────────────────────────────────────────
  openCobrar(): void {
    if (this.cart.isEmpty()) return;
    if (!this.cart.paymentMethod()) {
      this.cart.setPaymentMethod(this.payMethods()[0]?.label ?? 'Efectivo');
    }
    this.amountReceived.set(null);
    this.showCobrar.set(true);
  }

  selectMethod(label: string): void {
    this.cart.setPaymentMethod(label);
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Convierte las líneas del carrito al shape que persiste la orden. */
  private toOrderItems(): OrderItem[] {
    return this.cart.lines().map((l) => ({
      productId: l.productId,
      name: l.name,
      price: l.price,
      quantity: l.quantity,
      total: l.total,
      photo: l.photo,
      sku: l.sku,
      size: l.size,
      variantId: l.variantId,
      variantName: l.variantName,
      tierTitle: l.tierTitle,
      addons: l.addons,
      isCustom: l.isCustom,
      description: l.description,
    }));
  }

  async charge(): Promise<void> {
    if (this.cart.isEmpty() || this.isCharging()) return;
    this.isCharging.set(true);
    // Una venta en tienda nace cerrada (completada): descuenta stock y genera el
    // recibo, igual que "Registrar venta".
    const orderData = {
      name: this.cart.customerName() || 'Venta en tienda',
      phone: this.cart.customerPhone() || undefined,
      comments: this.cart.note() || undefined,
      status: 'completed' as OrderStatus,
      products: this.toOrderItems(),
      totalUsd: this.chargeTotal(),
      totalBs: this.chargeTotal() * this.exchangeRate(),
      deliveryDate: this.toIsoDate(new Date()),
      paymentMethod: this.cart.paymentMethod() || undefined,
      shippingFee: this.shipping() || undefined,
      // Venta de mostrador: marca el origen (métricas/devoluciones) y la imputa a
      // la caja abierta (si la hay) para el arqueo.
      source: 'pos',
      posCashSessionId: this.caja.openSessionId(),
    };
    try {
      const result = await this.orderStore.createOrder(orderData);
      result.fold(
        (error) => {
          this.toast.error(error as unknown as Exception);
          this.isCharging.set(false);
        },
        (order) => {
          // Snapshot del comprobante ANTES de vaciar el carrito.
          this.lastSale.set(this.buildReceipt(order));
          this.toast.success('Venta cobrada ✓');
          // Si la venta se imputó a una caja, refresca su arqueo.
          if (this.caja.hasOpenSession()) this.caja.refresh();
          this.cart.clear();
          this.shipping.set(0);
          this.amountReceived.set(null);
          this.showCobrar.set(false);
          this.showSuccess.set(true);
          this.isCharging.set(false);
        }
      );
    } catch {
      this.toast.error('Error inesperado al cobrar' as unknown as Exception);
      this.isCharging.set(false);
    }
  }

  /** Arma el comprobante desde el carrito ANTES de vaciarlo. */
  private buildReceipt(order: Order): PosSaleReceipt {
    const lines = this.cart.lines().map((l) => ({
      label:
        l.variantName || l.size
          ? `${l.name} · ${l.variantName ?? l.size}`
          : l.name,
      qty: l.quantity,
      total: l.total,
    }));
    return {
      number: order.orderNumber ?? order.id ?? null,
      dateStr: new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      customer: this.cart.customerName(),
      phone: this.cart.customerPhone(),
      lines,
      subtotal: this.cart.subtotal(),
      discount: this.cart.discountAmount(),
      shipping: this.shipping(),
      adjustAmount: this.adjustAmount(),
      total: this.chargeTotal(),
      method: this.cart.paymentMethod(),
      received: this.amountReceived(),
      change: this.change(),
    };
  }

  /** Cierra la pantalla de éxito para empezar otra venta. */
  newSale(): void {
    this.showSuccess.set(false);
    this.lastSale.set(null);
    this.amountReceived.set(null);
  }

  /** Abre el comprobante en una ventana e invoca la impresión del navegador
   *  (formato ticket 80 mm). Usa el encabezado/pie/logo de la Configuración. */
  printReceipt(): void {
    const sale = this.lastSale();
    if (!sale) return;
    const t = this.settings.ticket();
    const cs = this.cs();
    const money = (n: number) => `${cs}${n.toFixed(2)}`;
    const esc = (s: string) =>
      s.replace(
        /[&<>]/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string
      );
    const rows = sale.lines
      .map(
        (l) =>
          `<div class="r"><span>${l.qty}× ${esc(l.label)}</span><span>${money(l.total)}</span></div>`
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Recibo</title>
      <style>
        @page { margin: 0; }
        body { width: 80mm; margin: 0 auto; padding: 6mm 5mm; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
        .c { text-align: center; }
        .logo { max-width: 60%; max-height: 40px; display: block; margin: 0 auto 6px; }
        .hd { font-weight: 700; white-space: pre-wrap; margin-bottom: 6px; }
        .rule { border-top: 1px dashed #000; margin: 6px 0; }
        .r { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
        .tot { font-weight: 700; font-size: 13px; }
        .ft { margin-top: 8px; white-space: pre-wrap; }
        .meta { font-size: 11px; }
      </style></head><body>
      ${t.printLogo && t.logo ? `<img class="logo" src="${t.logo}" alt="logo">` : ''}
      ${t.header ? `<div class="c hd">${esc(t.header)}</div>` : ''}
      <div class="c meta">${esc(sale.dateStr)}${sale.number != null ? ` · #${sale.number}` : ''}</div>
      ${sale.customer ? `<div class="c meta">${esc(sale.customer)}</div>` : ''}
      <div class="rule"></div>
      ${rows}
      <div class="rule"></div>
      <div class="r"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
      ${sale.discount > 0 ? `<div class="r"><span>Descuento</span><span>-${money(sale.discount)}</span></div>` : ''}
      ${sale.shipping > 0 ? `<div class="r"><span>Envío</span><span>${money(sale.shipping)}</span></div>` : ''}
      ${sale.adjustAmount ? `<div class="r"><span>${sale.adjustAmount > 0 ? 'Recargo' : 'Descuento'} (${esc(sale.method)})</span><span>${sale.adjustAmount > 0 ? '+' : '-'}${money(Math.abs(sale.adjustAmount))}</span></div>` : ''}
      <div class="r tot"><span>TOTAL</span><span>${money(sale.total)}</span></div>
      ${sale.method ? `<div class="r"><span>Pago</span><span>${esc(sale.method)}</span></div>` : ''}
      ${sale.received != null ? `<div class="r"><span>Recibido</span><span>${money(sale.received)}</span></div><div class="r"><span>Vuelto</span><span>${money(sale.change)}</span></div>` : ''}
      ${t.footer ? `<div class="c ft">${esc(t.footer)}</div>` : ''}
      </body></html>`;
    const w = window.open('', '_blank', 'width=380,height=640');
    if (!w) {
      this.toast.error(
        'Permití las ventanas emergentes para imprimir el recibo' as unknown as Exception
      );
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // Dar tiempo a que renderice el logo/estilos antes de imprimir.
    setTimeout(() => w.print(), 250);
  }

  /** Comparte el recibo por WhatsApp como texto. Si el cliente tiene teléfono,
   *  abre el chat con ese número; si no, abre el selector de contacto. */
  shareReceiptWhatsApp(): void {
    const sale = this.lastSale();
    if (!sale) return;
    const cs = this.cs();
    const money = (n: number) => `${cs}${n.toFixed(2)}`;
    const t = this.settings.ticket();
    const parts: string[] = [];
    if (t.header) parts.push(`*${t.header}*`);
    parts.push(
      `Comprobante${sale.number != null ? ` #${sale.number}` : ''} · ${sale.dateStr}`
    );
    parts.push('');
    for (const l of sale.lines) {
      parts.push(`• ${l.qty}× ${l.label} — ${money(l.total)}`);
    }
    parts.push('');
    if (sale.discount > 0) parts.push(`Descuento: −${money(sale.discount)}`);
    if (sale.adjustAmount) {
      parts.push(
        `${sale.adjustAmount > 0 ? 'Recargo' : 'Descuento'} (${sale.method}): ${sale.adjustAmount > 0 ? '+' : '−'}${money(Math.abs(sale.adjustAmount))}`
      );
    }
    parts.push(`*Total: ${money(sale.total)}*`);
    if (sale.method) parts.push(`Pago: ${sale.method}`);
    if (t.footer) {
      parts.push('');
      parts.push(t.footer);
    }
    const text = encodeURIComponent(parts.join('\n'));
    const phone = sale.phone.replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }

  // ── Helpers de presentación ──────────────────────────────────────────────
  private iconForMethod(name: string): string {
    const n = name.toLowerCase();
    if (/efectivo|cash|contado/.test(n)) return 'banknote';
    if (/tarjeta|card|crédito|credito|débito|debito/.test(n)) return 'credit-card';
    if (/móvil|movil|zelle|pago/.test(n)) return 'smartphone';
    return 'wallet';
  }

  /** Etiqueta corta del stock para el chip de la tarjeta de producto. `text` es
   *  la key i18n (KEY-AS-TEXT) y `params` los valores a interpolar en la plantilla
   *  vía el pipe `transloco`. */
  stockLabel(p: Product): {
    text: string;
    tone: 'ok' | 'low' | 'out';
    params?: Record<string, unknown>;
  } {
    if (p.isSoldOut) return { text: 'Agotado', tone: 'out' };
    const n = this.stockNum(p);
    if (n == null) return { text: 'Disponible', tone: 'ok' };
    if (n <= 0) return { text: 'Sin stock', tone: 'out' };
    if (n <= 5) return { text: 'Quedan {count}', tone: 'low', params: { count: n } };
    return { text: '{count} en stock', tone: 'ok', params: { count: n } };
  }
}

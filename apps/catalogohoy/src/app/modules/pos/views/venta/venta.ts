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
  OrderItem,
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
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { PosCartStore } from '../../pos-cart.store';
import { PosSettingsStore } from '../../pos-settings.store';
import { PosScanner } from '../../components/scanner/scanner';

/** Un medio de pago ofrecido en el modal de cobro. */
interface PayMethod {
  label: string;
  icon: string;
}

@Component({
  selector: 'pos-venta',
  standalone: true,
  imports: [DecimalPipe, FormsModule, IconComponent, PosScanner],
  templateUrl: './venta.html',
  styleUrl: './venta.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosVenta implements OnInit {
  readonly productStore = inject(ProductStore);
  readonly cart = inject(PosCartStore);
  private readonly settings = inject(PosSettingsStore);
  private readonly orderStore = inject(OrderStore);
  private readonly rateStore = inject(RateStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly toast = inject(ToastService);

  private static readonly DEFAULT_METHODS: PayMethod[] = [
    { label: 'Efectivo', icon: 'banknote' },
    { label: 'Tarjeta', icon: 'credit-card' },
    { label: 'Transferencia', icon: 'wallet' },
    { label: 'Pago móvil', icon: 'smartphone' },
  ];

  // ── UI state ────────────────────────────────────────────────────────────
  readonly search = signal('');
  readonly showScanner = signal(false);
  /** Producto cuyas variantes/tallas se están eligiendo (null = ninguno). */
  readonly optionsProduct = signal<Product | null>(null);
  readonly showCobrar = signal(false);
  readonly amountReceived = signal<number | null>(null);
  readonly isCharging = signal(false);
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
      .map((m) => ({ label: m.label, icon: m.icon }));
    if (configured.length) return configured;
    const active = this.configStore
      .paymentMethodsList()
      .filter((m) => m.isActive)
      .map((m) => ({ label: m.name, icon: this.iconForMethod(m.name) }));
    return active.length ? active : PosVenta.DEFAULT_METHODS;
  });

  /** El medio elegido es efectivo → mostramos el campo "recibido" y el vuelto. */
  readonly isCash = computed(() =>
    /efectivo|cash|contado/i.test(this.cart.paymentMethod())
  );

  /** Vuelto = recibido − total (nunca negativo). */
  readonly change = computed(() => {
    const r = this.amountReceived();
    if (r == null) return 0;
    return Math.max(0, r - this.cart.total());
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
      totalUsd: this.cart.total(),
      totalBs: this.cart.total() * this.exchangeRate(),
      deliveryDate: this.toIsoDate(new Date()),
      paymentMethod: this.cart.paymentMethod() || undefined,
    };
    try {
      const result = await this.orderStore.createOrder(orderData);
      result.fold(
        (error) => {
          this.toast.error(error as unknown as Exception);
          this.isCharging.set(false);
        },
        () => {
          this.toast.success('Venta cobrada ✓');
          this.cart.clear();
          this.amountReceived.set(null);
          this.showCobrar.set(false);
          this.isCharging.set(false);
        }
      );
    } catch {
      this.toast.error('Error inesperado al cobrar' as unknown as Exception);
      this.isCharging.set(false);
    }
  }

  // ── Helpers de presentación ──────────────────────────────────────────────
  private iconForMethod(name: string): string {
    const n = name.toLowerCase();
    if (/efectivo|cash|contado/.test(n)) return 'banknote';
    if (/tarjeta|card|crédito|credito|débito|debito/.test(n)) return 'credit-card';
    if (/móvil|movil|zelle|pago/.test(n)) return 'smartphone';
    return 'wallet';
  }

  /** Etiqueta corta del stock para el chip de la tarjeta de producto. */
  stockLabel(p: Product): { text: string; tone: 'ok' | 'low' | 'out' } {
    if (p.isSoldOut) return { text: 'Agotado', tone: 'out' };
    const n = this.stockNum(p);
    if (n == null) return { text: 'Disponible', tone: 'ok' };
    if (n <= 0) return { text: 'Sin stock', tone: 'out' };
    if (n <= 5) return { text: `Quedan ${n}`, tone: 'low' };
    return { text: `${n} en stock`, tone: 'ok' };
  }
}

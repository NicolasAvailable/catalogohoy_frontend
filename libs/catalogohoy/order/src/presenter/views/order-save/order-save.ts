import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { EcommerceConfigStore, TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProductStore } from '@catalogohoy/product';
import { RateStore, RateType } from '@catalogohoy/rate';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  CardComponent,
  DatepickerComponent,
  IconComponent,
  InputNumberComponent,
  InputPhoneComponent,
  InputTextComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
  TextareaComponent,
  UploaderComponent,
} from '@ui';
import {
  Order,
  OrderItem,
  OrderItemAddon,
  OrderStatus,
  PaymentEvidence,
} from '../../../domain/order';
import { isVentaFeatureEnabled } from '../../../domain/venta-feature';
import { OrderStore } from '../../../infrastructure/order.store';

/** Un adicional del catálogo (pool global), con su foto para mostrarlo como
 *  mini-producto en el selector y los chips del alta manual de órdenes. */
interface CatalogAddon {
  id: string;
  name: string;
  price: number;
  photo: string | null;
}

@Component({
  selector: 'lib-order-save',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    TranslocoPipe,
    CardComponent,
    InputTextComponent,
    TextareaComponent,
    ButtonComponent,
    IconComponent,
    InputNumberComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    DatepickerComponent,
    InputPhoneComponent,
    UploaderComponent,
  ],
  templateUrl: './order-save.html',
  styleUrl: './order-save.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OrderSave implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  public readonly orderStore = inject(OrderStore);
  public readonly productStore = inject(ProductStore);
  public readonly rateStore = inject(RateStore);
  private readonly configStore = inject(EcommerceConfigStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  // Prices/totals are expressed in the catalog's reference (display) currency:
  // VE shows its chosen reference (USD '$' or EUR '€') with the Bs. column
  // alongside; every other country shows its local currency.
  public readonly cs = computed(
    () =>
      this.tenantCurrency.displaySymbol() ||
      this.configStore.config()?.currencySymbol ||
      '$'
  );
  private readonly permissions = inject(TeamPermissionsStore);
  protected readonly canEditOrder = computed(() => this.permissions.isOwner() || this.permissions.can()('ordenes', 'edit'));

  /** ISO country (lowercase) used to preselect the phone input's country code,
   *  matching the catalog's configured country. Defaults to Venezuela. */
  protected readonly defaultPhoneCountry = computed(() =>
    (this.configStore.config()?.countryCode || 'VE').toLowerCase()
  );

  /** Beta cerrada: la tarjeta de "Evidencia de pago" (y el resto de la venta en
   *  tienda) solo se muestra para los tenants del allowlist mientras la
   *  validamos. Los demás catálogos ven el alta de orden sin cambios. */
  protected readonly ventaFeatureEnabled = computed(() =>
    isVentaFeatureEnabled(this.tenantStore.tenantId())
  );

  private static readonly CUSTOM_PRODUCT_ID = '__custom__';

  public readonly selectableProducts = computed(() => {
    const real = this.productStore.productList().products;
    const customOption = {
      id: OrderSave.CUSTOM_PRODUCT_ID,
      name: 'Otros',
      price: 0,
      photos: [] as string[],
      isWholesale: false,
      wholesaleTiers: [] as { title: string; price: number }[],
    };
    return [customOption, ...real];
  });

  public readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, whiteSpacesValidator()]],
    phone: [''],
    comments: [''],
    status: ['pending' as OrderStatus],
    // Default: today. Admin can pick any date via the datepicker.
    deliveryDate: [new Date() as Date | null, [Validators.required]],
    // Manual orders mirror the public-catalog checkout: the admin picks
    // which method the customer paid with so the order list shows it.
    paymentMethod: [''],
    // Admin-only proof-of-payment note (goes with `paymentEvidenceImages`).
    paymentEvidenceNote: [''],
  });

  /** Active payment methods from the catalog config — same source the
   *  public checkout uses. Inactive methods stay hidden so the manual
   *  order form mirrors what's currently advertised in the catalog. */
  public readonly orderPaymentMethods = computed(() =>
    this.configStore.paymentMethodsList().filter((m) => m.isActive)
  );


  public readonly id = input<string | undefined>(undefined);
  /** When opened as "Registrar venta" (route query `?mode=venta`) the screen
   *  defaults the order to `completed` (a closed in-store sale → genera recibo
   *  y descuenta stock) and relabels the UI. Otherwise it's the normal manual
   *  order flow. */
  /** True when opened as "Registrar venta" (route `create?mode=venta`). Read
   *  from the query param in ngOnInit (no componentInputBinding dependency). */
  protected readonly isVenta = signal(false);
  public readonly products = signal<OrderItem[]>([]);
  /** POS: monto en efectivo que entrega el cliente; el cambio se calcula solo.
   *  Solo se usa en el form (calculadora para dar el vuelto); no se persiste. */
  public readonly amountReceived = signal<number | null>(null);
  public readonly change = computed(() => {
    const r = this.amountReceived();
    if (r == null || r === 0) return 0;
    // El cliente paga el bruto (subtotal + envío); la comisión es un costo del
    // vendedor, así que el vuelto se calcula sobre lo que el cliente entrega.
    return r - this.grossTotal();
  });
  /** Admin-only proof-of-payment images (transfer screenshots, receipts).
   *  Uploaded via <ui-uploader> to the same storage the product gallery uses;
   *  the note lives in the `paymentEvidenceNote` form control. */
  public readonly paymentEvidenceImages = signal<string[]>([]);
  /** Soft cap so a sale can't accumulate an unbounded gallery of proofs. */
  public readonly evidenceMaxImages = 6;
  /** Lightbox: which evidence image is open in the big preview (null = closed). */
  public readonly evidencePreviewUrl = signal<string | null>(null);
  public readonly isCreate = signal<boolean>(true);
  public readonly isSubmitting = signal<boolean>(false);
  public readonly totalBs = signal<number>(0);
  public readonly selectedRateType = signal<RateType>('bcv_usd');
  /** Envío/flete del alta manual (lo paga el cliente). Se suma al total. */
  public readonly shippingFee = signal<number>(0);
  /** Comisión (opcional) que paga el VENDEDOR: un costo suyo que se RESTA del
   *  total y no se le muestra al cliente. Puede cargarse como monto fijo o como
   *  porcentaje sobre el subtotal de productos. */
  public readonly commissionMode = signal<'fixed' | 'percent'>('fixed');
  public readonly commissionAmount = signal<number>(0);
  public readonly commissionPercent = signal<number>(0);
  /** Monto resuelto de la comisión (lo que efectivamente se resta y se guarda). */
  public readonly effectiveCommission = computed(() => {
    if (this.commissionMode() === 'percent') {
      const pct = Math.min(100, Math.max(0, this.commissionPercent() || 0));
      return (this.productsSubtotal() * pct) / 100;
    }
    return Math.max(0, this.commissionAmount() || 0);
  });
  /** Método de envío original de la orden (si vino del checkout público), para
   *  preservar su nombre al editar en vez de pisarlo con "Envío". */
  private readonly originalShippingMethod = signal<{
    name: string;
    type: 'pickup' | 'delivery' | 'shipping';
    fee: number;
  } | null>(null);
  /** Opción de envío elegida: '' = sin envío, un id de método del catálogo, o
   *  '__manual__' para cargar un monto libre (flete/comisión). */
  public readonly shippingSelection = signal<string>('');
  /** Opciones del selector de envío: los métodos ACTIVOS del catálogo (Editar
   *  catálogo → Envío, mismos que ve el checkout) + la opción de monto manual. */
  public readonly shippingOptions = computed<
    {
      value: string;
      name: string;
      fee: number;
      type: 'pickup' | 'delivery' | 'shipping';
      kind: 'catalog' | 'manual';
    }[]
  >(() => {
    const methods = (this.configStore.config()?.shippingMethods ?? []).filter(
      (m) => m.isActive
    );
    const opts = methods.map((m) => ({
      value: m.id,
      name: m.name,
      fee: m.fee ?? 0,
      type: m.type,
      kind: 'catalog' as const,
    }));
    return [
      ...opts,
      {
        value: '__manual__',
        name: 'Otro (monto manual)',
        fee: 0,
        type: 'shipping' as const,
        kind: 'manual' as const,
      },
    ];
  });

  /** Opciones del envío para el selector de tarjetas (estilo "Estado de la
   *  orden"): "Sin envío" + métodos del catálogo + monto manual. */
  public readonly shippingChoices = computed<
    { value: string; name: string; fee: number; kind: 'none' | 'catalog' | 'manual' }[]
  >(() => [
    { value: '', name: 'Sin envío', fee: 0, kind: 'none' },
    ...this.shippingOptions().map((o) => ({
      value: o.value,
      name: o.name,
      fee: o.fee,
      kind: o.kind,
    })),
  ]);

  public readonly exchangeRate = computed(() => {
    const rate = this.rateStore.rate();
    if (!rate) return 0;
    const rateMap: Record<string, number> = {
      bcv_usd: rate.bcv_usd ?? 0,
      bcv_eur: rate.bcv_eur ?? 0,
      custom: rate.custom_rate ?? 0,
    };
    return rateMap[this.selectedRateType()] ?? 0;
  });

  public readonly rateOptions: {
    label: string;
    value: RateType;
    icon: string;
  }[] = [
    { label: 'Dólar BCV', value: 'bcv_usd', icon: 'dollar-sign' },
    { label: 'Euro BCV', value: 'bcv_eur', icon: 'euro' },
    { label: 'Personalizada', value: 'custom', icon: 'settings-2' },
  ];

  ngOnInit(): void {
    // Prime tenant currency cache (localStorage → DB fallback) and load the
    // list of payment methods configured by the tenant so the selector can
    // populate.
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) {
        this.tenantCurrency.load(tid);
        this.configStore.loadPaymentMethods(String(tid));
        // Config del catálogo: de acá sale countryCode para preseleccionar
        // el país del input de teléfono (sin esto queda el fallback VE).
        this.configStore.loadConfig(String(tid));
      }
    });

    // Cargar tasas de cambio
    this.rateStore.loadRates().then(() => {
      const rate = this.rateStore.rate();
      if (rate) {
        this.selectedRateType.set(rate.active_rate);
      }
    });

    // Cargar productos primero, luego la orden (para que el select tenga opciones)
    this.productStore.productList$().then(() => {
      const orderId = this.id();
      if (orderId) {
        this.isCreate.set(false);
        this.loadOrder(orderId);
      }
    });

    // Registrar venta: el modo lo indica el query param ?mode=venta. Una venta
    // en tienda nace cerrada (completada) para generar el recibo y descontar
    // stock de una vez.
    this.isVenta.set(
      this.route.snapshot.data['mode'] === 'venta' ||
        this.route.snapshot.queryParamMap.get('mode') === 'venta'
    );
    if (this.isVenta() && !this.id()) {
      this.form.controls.status.setValue('completed');
    }
  }

  private async loadOrder(id: string) {
    const result = await this.orderStore.getOrderById(Number(id));
    if (result) {
      this.setValuesForm(result);
    }
  }

  /** Format a Date as "YYYY-MM-DD" in local time. `toISOString()` would
   *  shift by the timezone offset and can land on a different calendar day. */
  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private setValuesForm(order: Order) {
    this.form.controls.name.setValue(order.name);
    this.form.controls.phone.setValue(order.phone || '');
    this.form.controls.comments.setValue(order.comments || '');
    this.form.controls.status.setValue(order.status);
    this.form.controls.paymentMethod.setValue(order.paymentMethod || '');
    this.form.controls.paymentEvidenceNote.setValue(
      order.paymentEvidence?.note || ''
    );
    this.paymentEvidenceImages.set(order.paymentEvidence?.images ?? []);
    if (order.deliveryDate) {
      // Parse "YYYY-MM-DD" as local date (avoid the UTC-shift that new Date(iso) causes).
      const [y, m, d] = order.deliveryDate.split('-').map(Number);
      this.form.controls.deliveryDate.setValue(new Date(y, m - 1, d));
    }

    const storeProducts = this.productStore.productList().products;
    this.products.set(
      order.products.map((p) => {
        const match = storeProducts.find((sp) => String(sp.id) === String(p.productId));
        return {
          ...p,
          productId: match ? match.id : p.productId,
        };
      })
    );
    this.totalBs.set(order.totalBs ?? 0);
    const sm = order.shippingMethod ?? null;
    this.originalShippingMethod.set(sm);
    this.shippingFee.set(order.shippingFee ?? sm?.fee ?? 0);
    // La comisión se guarda como monto resuelto: al editar se muestra en modo
    // "monto fijo" con ese valor (el % es una comodidad al crear).
    this.commissionMode.set('fixed');
    this.commissionAmount.set(order.commission ?? 0);
    this.commissionPercent.set(0);
    if (sm) {
      // Mapear al método del catálogo por nombre; si no matchea (manual o
      // método borrado), cae a "Otro" conservando el snapshot original.
      const match = (this.configStore.config()?.shippingMethods ?? []).find(
        (m) => m.isActive && m.name === sm.name
      );
      this.shippingSelection.set(match ? match.id : '__manual__');
    } else {
      this.shippingSelection.set('');
    }
  }

  public addProduct() {
    this.products.update((products) => [
      ...products,
      {
        productId: '',
        name: '',
        price: 0,
        quantity: 1,
        total: 0,
      },
    ]);
  }

  public addCustomProduct() {
    this.products.update((products) => [
      ...products,
      {
        productId: OrderSave.CUSTOM_PRODUCT_ID,
        name: '',
        price: 0,
        quantity: 1,
        total: 0,
        isCustom: true,
        description: '',
      },
    ]);
  }

  public cancelCustomProduct(index: number) {
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = {
        productId: '',
        name: '',
        price: 0,
        quantity: 1,
        total: 0,
        isCustom: false,
        description: undefined,
      };
      return updated;
    });
  }

  public removeProduct(index: number) {
    this.products.update((products) => products.filter((_, i) => i !== index));
  }

  public onProductSelect(index: number, productId: string) {
    if (productId === OrderSave.CUSTOM_PRODUCT_ID) {
      this.products.update((products) => {
        const updated = [...products];
        updated[index] = {
          ...updated[index],
          productId: OrderSave.CUSTOM_PRODUCT_ID,
          name: '',
          price: 0,
          photo: undefined,
          total: 0,
          isCustom: true,
          description: '',
        };
        return updated;
      });
      return;
    }

    const selectedProduct = this.productStore
      .productList()
      .products.find((p) => p.id === productId);

    if (selectedProduct) {
      const isWholesale =
        selectedProduct.isWholesale && selectedProduct.wholesaleTiers.length > 0;
      const price = isWholesale
        ? selectedProduct.wholesaleTiers[0].price
        : selectedProduct.pricePromotional > 0
          ? selectedProduct.pricePromotional
          : selectedProduct.price;

      this.products.update((products) => {
        const updated = [...products];
        updated[index] = {
          ...updated[index],
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price,
          photo: selectedProduct.photos?.[0],
          total: price * updated[index].quantity,
          isCustom: false,
          // Al mayor arranca en el primer tramo; el select de escala permite
          // cambiarlo (onTierSelect). Producto normal no lleva tramo.
          tierTitle: isWholesale ? selectedProduct.wholesaleTiers[0].title : null,
          // Cambiar de producto descarta variante y adicionales del anterior.
          variantId: null,
          variantName: null,
          addons: null,
        };
        return updated;
      });
    }
  }

  /** Tramos de mayoreo del producto de la fila (vacío si no es al mayor). */
  public getWholesaleTiers(
    productId: string | number
  ): { title: string; price: number }[] {
    const product = this.productStore
      .productList()
      .products.find((p) => p.id === productId);
    return product?.isWholesale ? product.wholesaleTiers ?? [] : [];
  }

  /** Cambia el tramo de mayoreo de la fila: actualiza precio y snapshot.
   *  Preserva los adicionales elegidos (su suma va encima del tramo). */
  public onTierSelect(index: number, tierTitle: string) {
    const row = this.products()[index];
    const tier = this.getWholesaleTiers(row.productId).find(
      (t) => t.title === tierTitle
    );
    if (!tier) return;
    this.products.update((products) => {
      const updated = [...products];
      const price = tier.price + this.addonsSum(updated[index].addons);
      updated[index] = {
        ...updated[index],
        price,
        tierTitle: tier.title,
        total: price * updated[index].quantity,
      };
      return updated;
    });
  }

  /** Variantes del producto de la fila (vacío si no tiene). */
  public getVariants(
    productId: string | number
  ): { id: string; name: string; price: number; photo: string | null }[] {
    const product = this.productStore
      .productList()
      .products.find((p) => p.id === productId);
    if (!product?.isVariant) return [];
    return (product.variants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      photo: v.photos?.[0] ?? null,
    }));
  }

  /** Cambia la variante de la fila (null = Producto original): actualiza
   *  snapshot, foto y unitario (variante + adicionales elegidos). */
  public onVariantSelect(index: number, variantId: string | null) {
    const row = this.products()[index];
    const product = this.productStore
      .productList()
      .products.find((p) => p.id === row.productId);
    if (!product) return;
    const variant = variantId
      ? product.variants?.find((v) => v.id === variantId) ?? null
      : null;
    this.products.update((products) => {
      const updated = [...products];
      const addonsSum = this.addonsSum(updated[index].addons);
      const base = variant
        ? variant.price
        : product.pricePromotional > 0
          ? product.pricePromotional
          : product.price;
      const price = base + addonsSum;
      updated[index] = {
        ...updated[index],
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        photo: variant?.photos?.[0] ?? product.photos?.[0],
        price,
        total: price * updated[index].quantity,
      };
      return updated;
    });
  }

  /** Clave de deduplicación de un adicional: mismo nombre + precio = el mismo
   *  adicional (aunque esté definido en productos distintos con ids propios). */
  private addonKey(a: { name: string; price: number }): string {
    return `${a.name.trim().toLowerCase()}|${a.price}`;
  }

  /** Pool global de adicionales: unión de los adicionales de TODOS los productos
   *  del catálogo, deduplicados por nombre+precio y ordenados por nombre. Permite
   *  agregar a una orden manual cualquier adicional, no solo los del producto de
   *  la fila. Conserva la foto para mostrarlo como un mini-producto. */
  public readonly allAddons = computed<CatalogAddon[]>(() => {
    const seen = new Map<string, CatalogAddon>();
    for (const product of this.productStore.productList().products) {
      for (const a of product.addons ?? []) {
        const key = this.addonKey(a);
        if (!seen.has(key)) {
          seen.set(key, {
            id: a.id,
            name: a.name,
            price: a.price,
            photo: a.photo ?? null,
          });
        }
      }
    }
    return [...seen.values()].sort((x, y) => x.name.localeCompare(y.name));
  });

  /** Adicionales del pool global que la fila aún NO tiene (opciones del
   *  selector "Agregar adicional"). Se compara por nombre+precio para que un
   *  adicional ya agregado no vuelva a ofrecerse. */
  public availableAddons(index: number): CatalogAddon[] {
    const selected = new Set(
      (this.products()[index]?.addons ?? []).map((a) => this.addonKey(a))
    );
    return this.allAddons().filter((a) => !selected.has(this.addonKey(a)));
  }

  /** Foto del adicional para mostrar en el chip. El snapshot de la orden solo
   *  guarda nombre+precio, así que la imagen se resuelve del pool global. */
  public addonPhoto(addon: { name: string; price: number }): string | null {
    return (
      this.allAddons().find((a) => this.addonKey(a) === this.addonKey(addon))
        ?.photo ?? null
    );
  }

  /** Agrega a la fila un adicional elegido en el selector del pool global. */
  public onAddonAdd(index: number, addonId: string | null): void {
    if (!addonId) return;
    const addon = this.allAddons().find((a) => a.id === addonId);
    if (!addon) return;
    if (this.products()[index]?.addons?.some((a) => a.id === addon.id)) return;
    this.onAddonToggle(index, addon);
  }

  /** Contribución de los adicionales al unitario: Σ precio × cantidad (la
   *  cantidad ausente cuenta como 1). */
  private addonsSum(addons: OrderItemAddon[] | null | undefined): number {
    return (addons ?? []).reduce(
      (sum, a) => sum + a.price * (a.quantity ?? 1),
      0
    );
  }

  /** Marca/desmarca un adicional de la fila: actualiza el snapshot y
   *  recalcula el unitario como base (tramo o precio/promo) + adicionales —
   *  el mismo criterio que el checkout del storefront. Al agregar arranca en
   *  cantidad 1. */
  public onAddonToggle(index: number, addon: OrderItemAddon) {
    this.products.update((products) => {
      const updated = [...products];
      const row = updated[index];
      const current = row.addons ?? [];
      const addons = current.some((a) => a.id === addon.id)
        ? current.filter((a) => a.id !== addon.id)
        : [...current, { ...addon, quantity: addon.quantity ?? 1 }];
      const price = this.rowBaseUnitPrice(row) + this.addonsSum(addons);
      updated[index] = {
        ...row,
        addons: addons.length ? addons : null,
        price,
        total: price * row.quantity,
      };
      return updated;
    });
  }

  /** Cantidad actual de un adicional en la fila (1 por defecto). */
  public addonQty(addon: OrderItemAddon): number {
    return addon.quantity ?? 1;
  }

  /** Cambia la cantidad de un adicional (+1 / -1). Bajar de 1 lo quita. */
  public changeAddonQty(index: number, addonId: string | undefined, delta: number) {
    this.products.update((products) => {
      const updated = [...products];
      const row = updated[index];
      const addons = (row.addons ?? [])
        .map((a) =>
          a.id === addonId ? { ...a, quantity: (a.quantity ?? 1) + delta } : a
        )
        .filter((a) => (a.quantity ?? 1) > 0);
      const price = this.rowBaseUnitPrice(row) + this.addonsSum(addons);
      updated[index] = {
        ...row,
        addons: addons.length ? addons : null,
        price,
        total: price * row.quantity,
      };
      return updated;
    });
  }

  /** Precio unitario de la fila SIN adicionales: variante o tramo elegido,
   *  o el precio (promo) actual del producto. Si el producto ya no está en
   *  el store, se deduce restando los adicionales del precio guardado. */
  private rowBaseUnitPrice(row: OrderItem): number {
    const product = this.productStore
      .productList()
      .products.find((p) => p.id === row.productId);
    if (!product) {
      return row.price - this.addonsSum(row.addons);
    }
    if (row.variantId) {
      const variant = product.variants?.find((v) => v.id === row.variantId);
      if (variant) return variant.price;
    }
    if (row.tierTitle) {
      const tier = product.wholesaleTiers?.find(
        (t) => t.title === row.tierTitle
      );
      if (tier) return tier.price;
    }
    return product.pricePromotional > 0
      ? product.pricePromotional
      : product.price;
  }

  public onCustomNameChange(index: number, name: string) {
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = { ...updated[index], name };
      return updated;
    });
  }

  public onCustomDescriptionChange(index: number, description: string) {
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = { ...updated[index], description };
      return updated;
    });
  }

  public onCustomPriceChange(index: number, price: number) {
    const safePrice = price || 0;
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = {
        ...updated[index],
        price: safePrice,
        total: safePrice * updated[index].quantity,
      };
      return updated;
    });
  }

  public onQuantityChange(index: number, quantity: number) {
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = {
        ...updated[index],
        quantity: quantity || 1,
        total: updated[index].price * (quantity || 1),
      };
      return updated;
    });
  }

  /** Suma de las líneas de producto (sin envío). */
  public productsSubtotal(): number {
    return this.products().reduce((sum, product) => sum + product.total, 0);
  }

  /** Total de la orden = productos + envío. */
  /** Lo que paga el cliente: subtotal + envío (antes de la comisión del
   *  vendedor). Base del cálculo de cambio del POS. */
  public grossTotal(): number {
    return this.productsSubtotal() + this.effectiveShippingFee();
  }

  /** Total neto que se guarda/muestra: lo que paga el cliente MENOS la comisión
   *  que paga el vendedor (nunca baja de 0). */
  public calculateTotal(): number {
    return Math.max(0, this.grossTotal() - this.effectiveCommission());
  }

  /** Costo de envío que efectivamente se suma al total (0 si no hay envío). */
  public effectiveShippingFee(): number {
    return this.shippingSelection() === '' ? 0 : this.shippingFee() || 0;
  }

  public setCommissionMode(mode: 'fixed' | 'percent'): void {
    this.commissionMode.set(mode);
  }

  /** Monto fijo de la comisión (no baja de 0). */
  public onCommissionAmountChange(value: number): void {
    this.commissionAmount.set(Math.max(0, value || 0));
  }

  /** Porcentaje de la comisión (0–100). */
  public onCommissionPercentChange(value: number): void {
    this.commissionPercent.set(Math.min(100, Math.max(0, value || 0)));
  }

  /** Cambia la opción de envío. Un método del catálogo precarga su costo
   *  (editable para esta orden); "Otro" deja el monto libre; vacío = sin envío. */
  public onShippingSelectionChange(value: string | null): void {
    const sel = value ?? '';
    this.shippingSelection.set(sel);
    if (sel === '') {
      this.shippingFee.set(0);
      return;
    }
    if (sel === '__manual__') return; // el admin escribe el monto
    const method = (this.configStore.config()?.shippingMethods ?? []).find(
      (m) => m.id === sel
    );
    if (method) this.shippingFee.set(method.fee ?? 0);
  }

  /** Actualiza el monto de envío (no baja de 0). El total en la moneda de
   *  referencia se recalcula solo; el de Bs. se refresca con "Recalcular"
   *  (igual que al cambiar cantidades). */
  public onShippingFeeChange(value: number): void {
    this.shippingFee.set(Math.max(0, value || 0));
  }

  /** Snapshot de envío para guardar según la opción elegida: vacío = null;
   *  un método del catálogo = su nombre/tipo con el costo (posiblemente
   *  ajustado); "Otro" con monto > 0 = etiqueta "Envío" (o el método original
   *  al editar una orden del catálogo). */
  private buildShippingMethod(): {
    name: string;
    type: 'pickup' | 'delivery' | 'shipping';
    fee: number;
  } | null {
    const sel = this.shippingSelection();
    if (sel === '') return null;
    const fee = this.shippingFee() || 0;
    if (sel === '__manual__') {
      if (fee <= 0) return null;
      const original = this.originalShippingMethod();
      return original ? { ...original, fee } : { name: 'Envío', type: 'shipping', fee };
    }
    const method = (this.configStore.config()?.shippingMethods ?? []).find(
      (m) => m.id === sel
    );
    if (method) return { name: method.name, type: method.type, fee };
    const original = this.originalShippingMethod();
    return original ? { ...original, fee } : null;
  }

  public recalculateTotalBs() {
    const totalUsd = this.calculateTotal();
    const rate = this.exchangeRate();
    this.totalBs.set(totalUsd * rate);
  }

  public async onRateTypeChange(rateType: RateType) {
    this.selectedRateType.set(rateType);

    // Actualizar la tasa activa globalmente
    const result = await this.rateStore.updateActiveRate(rateType);
    result.fold(
      (error: string) => {
        this.toastService.error(new Exception(error));
      },
      () => {
        this.toastService.success('Tasa activa actualizada');
        this.recalculateTotalBs();
      }
    );
  }

  /** <ui-uploader> finished uploading: append the new URL(s) up to the cap. */
  public onEvidenceUploaded(value: string | string[]): void {
    const incoming = Array.isArray(value) ? value : [value];
    this.paymentEvidenceImages.update((imgs) => {
      const room = this.evidenceMaxImages - imgs.length;
      return room <= 0 ? imgs : [...imgs, ...incoming.slice(0, room)];
    });
  }

  /** Remove one proof-of-payment image from the list. Does not delete the
   *  uploaded file from storage (same behaviour as the product gallery). */
  public removeEvidenceImage(url: string): void {
    this.paymentEvidenceImages.update((imgs) => imgs.filter((u) => u !== url));
  }

  /** Open the big preview (lightbox) for a proof-of-payment image. */
  public openEvidencePreview(url: string): void {
    this.evidencePreviewUrl.set(url);
  }

  public closeEvidencePreview(): void {
    this.evidencePreviewUrl.set(null);
  }

  /** Builds the PaymentEvidence to persist, or null when the admin left both
   *  the note and the images empty (keeps the column null for plain orders). */
  private buildPaymentEvidence(): PaymentEvidence | null {
    const note = (this.form.controls.paymentEvidenceNote.value || '').trim();
    const images = this.paymentEvidenceImages();
    if (!note && images.length === 0) return null;
    return { note: note || undefined, images };
  }

  public async save() {
    if (this.form.invalid) {
      this.toastService.error(
        'Por favor completa los campos requeridos' as unknown as Exception
      );
      return;
    }

    if (this.products().length === 0) {
      this.toastService.error(
        'Debes agregar al menos un producto' as unknown as Exception
      );
      return;
    }

    this.isSubmitting.set(true);

    const delivery = this.form.controls.deliveryDate.value;
    const orderData = {
      name: this.form.controls.name.value as string,
      phone: this.form.controls.phone.value || undefined,
      comments: this.form.controls.comments.value || undefined,
      status: this.form.controls.status.value as OrderStatus,
      products: this.products(),
      totalUsd: this.calculateTotal(),
      totalBs: this.totalBs(),
      deliveryDate: delivery ? this.toIsoDate(delivery) : undefined,
      paymentMethod: this.form.controls.paymentMethod.value || undefined,
      paymentEvidence: this.buildPaymentEvidence(),
      shippingFee: this.effectiveShippingFee(),
      commission: this.effectiveCommission(),
      shippingMethod: this.buildShippingMethod(),
    };

    try {
      if (this.isCreate()) {
        const result = await this.orderStore.createOrder(orderData);
        result.fold(
          (error) => {
            this.toastService.error(error as unknown as Exception);
            this.isSubmitting.set(false);
          },
          () => {
            this.toastService.success(
              this.isVenta()
                ? 'Venta registrada exitosamente'
                : 'Orden creada exitosamente'
            );
            this.router.navigate(['/admin/orders']);
          }
        );
      } else {
        const result = await this.orderStore.updateOrder({
          id: Number(this.id()),
          ...orderData,
        });
        result.fold(
          (error) => {
            this.toastService.error(error as unknown as Exception);
            this.isSubmitting.set(false);
          },
          () => {
            this.toastService.success('Orden actualizada exitosamente');
            this.router.navigate(['/admin/orders']);
          }
        );
      }
    } catch {
      this.toastService.error('Error inesperado' as unknown as Exception);
      this.isSubmitting.set(false);
    }
  }
}

import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MetaPixelService } from '@catalogohoy/core';
import {
  flagEmoji,
  paymentMethodFields,
  ShippingMethod,
  SUPPORTED_COUNTRIES,
} from '@catalogohoy/ecommerce-config';
import {
  DatepickerComponent,
  IconComponent,
  InputTextComponent,
  QrCodeComponent,
  TextareaComponent,
} from '@ui';
import { CartItem } from '../../../domain';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { TenantPricePipe } from '../../pipes/tenant-price.pipe';

function isPagoMovil(name: string): boolean {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .includes('pago movil');
}

type CheckoutPhase = 'form' | 'confirm' | 'sent';

@Component({
  selector: 'lib-checkout',
  imports: [
    DecimalPipe,
    FormsModule,
    DatepickerComponent,
    IconComponent,
    InputTextComponent,
    TextareaComponent,
    QrCodeComponent,
    TenantPricePipe,
    TranslocoPipe,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Checkout {
  public readonly cartStore = inject(CartStore);
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cs = this.ecommerceStore.currencySymbol;
  private readonly metaPixel = inject(MetaPixelService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  /** Rendered inside the catalog-editor preview iframe (?preview=true). In that
   *  mode there's no real cart, so the empty-cart guard must not bounce out —
   *  the merchant is just looking at how checkout will appear. */
  private readonly isPreview =
    new URLSearchParams(window.location.search).get('preview') === 'true';

  // --- Customer form ---
  public readonly name = signal('');
  public readonly phone = signal('');
  public readonly email = signal('');
  public readonly comments = signal('');
  public readonly countryCode = signal('+58');
  public readonly countryIso = signal('VE');
  public readonly countryDropdownOpen = signal(false);
  public readonly selectedPaymentMethod = signal<string>('');

  // --- Shipping ---
  public readonly selectedShippingId = signal<string | null>(null);
  public readonly customerAddress = signal('');

  // --- Delivery date ---
  /** Customer-chosen delivery date. Null until picked. Held as a `Date` for the
   *  PrimeNG datepicker; serialised to `YYYY-MM-DD` (local) only on submit. */
  public readonly deliveryDate = signal<Date | null>(null);

  // --- Post-order flow ---
  public readonly phase = signal<CheckoutPhase>('form');
  public readonly isSubmitting = signal(false);
  public readonly pendingWhatsappUrl = signal<string | null>(null);
  public readonly pendingMessage = signal<string>('');
  public readonly lastOrderId = signal<number | null>(null);

  public readonly info = this.ecommerceStore.effectiveCatalogInfo;

  /** Customer-field config (visible/required) for name/phone/email. */
  public readonly customerFields = computed(
    () =>
      this.info()?.customerFields ?? {
        name: { visible: true, required: true },
        phone: { visible: true, required: true },
        email: { visible: false, required: false },
      }
  );

  /** Active shipping options, ordered, only when the section is enabled. */
  public readonly shippingMethods = computed<ShippingMethod[]>(() => {
    const i = this.info();
    if (!i?.showShippingSection) return [];
    return [...(i.shippingMethods ?? [])]
      .filter((m) => m.isActive)
      .sort((a, b) => a.position - b.position);
  });

  public readonly hasShipping = computed(() => this.shippingMethods().length > 0);

  // --- Delivery date ---
  /** Whether the merchant enabled the delivery-date picker for this catalog. */
  public readonly deliveryDateEnabled = computed(
    () => this.info()?.deliveryDateEnabled ?? false
  );

  /** Weekdays with no delivery (JS: 0 = Sunday … 6 = Saturday). */
  public readonly deliveryBlockedWeekdays = computed<number[]>(
    () => this.info()?.deliveryBlockedWeekdays ?? []
  );

  /** Local midnight today — used as the datepicker `minDate` so past dates
   *  can't be picked. */
  public readonly todayDate = computed(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** True when the chosen date falls on a blocked weekday. The datepicker
   *  already disables those days (`disabledDays`); this is a submit-time guard
   *  in case a stale value slips through. */
  public readonly deliveryDateIsBlocked = computed(() => {
    const date = this.deliveryDate();
    if (!date) return false;
    return this.deliveryBlockedWeekdays().includes(date.getDay());
  });

  public readonly selectedShipping = computed<ShippingMethod | null>(
    () =>
      this.shippingMethods().find((m) => m.id === this.selectedShippingId()) ??
      null
  );

  public readonly shippingFee = computed(
    () => this.selectedShipping()?.fee ?? 0
  );

  public readonly subtotal = computed(() => this.cartStore.totalPrice());
  public readonly total = computed(() => this.subtotal() + this.shippingFee());

  /** Bolívares mirror of the total — Venezuela only and only with a rate. */
  public readonly showBs = computed(
    () => this.ecommerceStore.isVenezuela() && this.ecommerceStore.exchangeRate() > 0
  );
  public readonly totalBs = computed(
    () => this.total() * this.ecommerceStore.exchangeRate()
  );

  public readonly availablePaymentMethods = computed(() => {
    const i = this.info();
    if (!i?.showPaymentMethodsSection || !i.paymentMethods?.length) return [];
    if (this.ecommerceStore.isVenezuela()) return i.paymentMethods;
    return i.paymentMethods.filter((m) => !isPagoMovil(m.name));
  });

  /** Datos (banco, cuenta, etc.) del método de pago elegido, listos para
   *  mostrar en el checkout. Solo campos con valor. */
  public readonly selectedPaymentInfo = computed(() => {
    const name = this.selectedPaymentMethod();
    if (!name) return [];
    const method = this.availablePaymentMethods().find((m) => m.name === name);
    const details = method?.details ?? {};
    return paymentMethodFields(name, this.ecommerceStore.isVenezuela())
      .map((f) => ({ label: f.label, value: (details[f.key] ?? '').trim() }))
      .filter((f) => f.value.length > 0);
  });

  /** True si el método tiene datos cargados (muestra el chevron en su fila). */
  public hasPaymentInfo(pm: { name: string; details?: Record<string, string> | null }): boolean {
    const details = pm.details ?? {};
    return paymentMethodFields(pm.name, this.ecommerceStore.isVenezuela()).some(
      (f) => (details[f.key] ?? '').trim().length > 0
    );
  }

  /** Feedback transitorio del botón "Copiar datos". */
  public readonly paymentInfoCopied = signal(false);

  public copyPaymentInfo(): void {
    const info = this.selectedPaymentInfo();
    if (!info.length) return;
    const text = info.map((f) => `${f.label}: ${f.value}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      this.paymentInfoCopied.set(true);
      setTimeout(() => this.paymentInfoCopied.set(false), 1800);
    });
  }

  /** WhatsApp seller button to send the order to (first configured one). */
  public readonly whatsappButton = computed(
    () => this.info()?.whatsappButtons?.find((b) => b.number?.trim()) ?? null
  );

  /** All configured seller WhatsApp buttons that have a number. The customer
   *  chooses which seller to send the order to (the catalog allows up to 3). */
  public readonly whatsappButtons = computed(() =>
    (this.info()?.whatsappButtons ?? []).filter((b) => b.number?.trim())
  );

  private userPickedCountry = false;

  constructor() {
    // Default phone country from the catalog's country (ISO-2).
    effect(() => {
      if (this.userPickedCountry) return;
      const iso = this.info()?.countryCode;
      if (!iso) return;
      const match = this.countryCodes.find((c) => c.iso === iso);
      if (!match) return;
      this.countryIso.set(match.iso);
      this.countryCode.set(match.code);
    });

    // Preselect the default shipping method (or the first) once they load.
    effect(() => {
      const methods = this.shippingMethods();
      if (!methods.length) return;
      if (this.selectedShippingId() && methods.some((m) => m.id === this.selectedShippingId())) {
        return;
      }
      const def = methods.find((m) => m.isDefault) ?? methods[0];
      this.selectedShippingId.set(def.id);
    });

    // Guard: an empty cart has nothing to check out. Bounce back to the store
    // (covers landing on /checkout directly and removing the last item). Only
    // while filling the form — after submit the cart is intentionally cleared
    // and we stay on the confirm/sent screens.
    effect(() => {
      if (this.isPreview) return;
      if (this.phase() === 'form' && this.cartStore.isEmpty()) {
        this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
      }
    });
  }

  // --- Cart line-item controls ---
  onIncrement(item: CartItem) {
    this.cartStore.incrementItem(item.id);
  }
  onDecrement(item: CartItem) {
    this.cartStore.decrementItem(item.id);
  }
  onRemove(item: CartItem) {
    this.cartStore.removeItem(item.id);
  }

  goToStore() {
    // Inside the editor preview the checkout is the only thing being shown —
    // no navigation button may leave it, or the merchant gets bounced to the
    // storefront and loses the preview.
    if (this.isPreview) return;
    // Real "back" so the catalog keeps its already-loaded state/tenant context
    // (in dev the slug is derived from the path, so re-navigating to '/' from a
    // path route like /checkout can lose it). Fall back to the store root when
    // there's no history (e.g. the checkout was opened directly).
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
    }
  }

  // --- Shipping ---
  selectShipping(id: string) {
    this.selectedShippingId.set(id);
  }

  // --- Validation ---
  get isValid(): boolean {
    const f = this.customerFields();
    // Name is always required, regardless of config.
    if (!this.name().trim()) return false;
    if (f.phone.visible && f.phone.required && !this.phone().trim()) return false;
    if (f.email.visible && f.email.required && !this.isValidEmail(this.email()))
      return false;

    const methods = this.availablePaymentMethods();
    if (methods.length > 0 && !this.selectedPaymentMethod()) return false;

    if (this.hasShipping() && !this.selectedShippingId()) return false;
    const sel = this.selectedShipping();
    if (sel?.requestCustomerAddress && !this.customerAddress().trim()) return false;

    // Delivery date: required when the feature is on, must not be in the past
    // and must not land on a blocked weekday (the picker enforces both, this
    // guards submit).
    if (this.deliveryDateEnabled()) {
      const date = this.deliveryDate();
      if (!date) return false;
      if (this.toIsoDate(date) < this.toIsoDate(this.todayDate())) return false;
      if (this.deliveryDateIsBlocked()) return false;
    }

    return !this.cartStore.isEmpty();
  }

  private isValidEmail(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  // --- Submit ---
  async onSubmit(button?: { name: string; number: string } | null) {
    if (!this.isValid || this.isSubmitting()) return;
    // The customer may pick which seller to send the order to; fall back to the
    // first configured one when no specific seller is passed.
    const seller = button ?? this.whatsappButton();
    if (!seller?.number) {
      alert(
        this.transloco.translate(
          'Este catálogo no tiene un número de WhatsApp configurado.'
        )
      );
      return;
    }

    this.isSubmitting.set(true);

    const items = this.cartStore.items();
    const subtotal = this.subtotal();
    const fee = this.shippingFee();
    const total = this.total();
    const f = this.customerFields();
    const sel = this.selectedShipping();
    const phoneFull = f.phone.visible ? `${this.countryCode()} ${this.phone()}`.trim() : '';

    const orderResult = await this.ecommerceStore.createOrder({
      name: this.name().trim() || 'Cliente',
      phone: phoneFull,
      email: f.email.visible ? this.email().trim() || undefined : undefined,
      comments: this.comments(),
      items: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        photo: item.photo,
        sku: item.sku ?? null,
        size: item.size ?? null,
        variantId: item.variantId ?? null,
        variantName: item.variantName ?? null,
        // Snapshot del tramo de mayoreo elegido (el precio unitario ya lo
        // refleja); antes se perdía al crear la orden.
        tierTitle: item.tierTitle ?? null,
        // Adicionales elegidos (nombre + precio unitario). Su precio ya está
        // sumado en `item.price`, pero se guardan para itemizarlos en la
        // factura/recibo (antes no se mostraban).
        addons: item.addons ?? [],
      })),
      total,
      payment_method: this.selectedPaymentMethod() || undefined,
      shipping_method: sel
        ? { name: sel.name, type: sel.type, fee: sel.fee }
        : null,
      shipping_address: sel?.requestCustomerAddress
        ? this.customerAddress().trim() || null
        : null,
      shipping_fee: fee,
      // Only send when the feature is on and the customer picked a date; else
      // the server keeps its default (CURRENT_DATE). Serialise as local ISO to
      // avoid the UTC off-by-one that `toISOString()` would introduce.
      delivery_date:
        this.deliveryDateEnabled() && this.deliveryDate()
          ? this.toIsoDate(this.deliveryDate() as Date)
          : undefined,
    });

    if (!orderResult || orderResult.isLeft()) {
      this.isSubmitting.set(false);
      alert(
        this.transloco.translate(
          'Hubo un error al procesar tu pedido. Por favor intenta de nuevo.'
        )
      );
      return;
    }

    this.lastOrderId.set(orderResult.value.id);

    const message = this.buildWhatsappMessage(items, subtotal, fee, total, sel);
    const whatsappNumber = seller.number.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    this.metaPixel.trackEvent('Purchase', {
      currency: 'USD',
      value: total,
      num_items: items.length,
    });

    this.pendingMessage.set(message);
    this.pendingWhatsappUrl.set(whatsappUrl);
    // Flip the phase BEFORE clearing the cart so the empty-cart guard (which
    // only fires in the 'form' phase) doesn't bounce us off the confirm screen.
    this.phase.set('confirm');
    this.cartStore.clearCart();
    this.isSubmitting.set(false);
  }

  private buildWhatsappMessage(
    items: CartItem[],
    subtotal: number,
    fee: number,
    total: number,
    shipping: ShippingMethod | null
  ): string {
    const symbol = this.cs();

    let productsList = '';
    items.forEach((item) => {
      const sizeLabel = item.size ? ` (Talla ${item.size})` : '';
      const variantLabel = item.variantName ? ` (${item.variantName})` : '';
      productsList += `• ${item.name}${variantLabel}${sizeLabel} x${item.quantity} - ${symbol}${item.total}\n`;
    });

    const totalBsStr = this.showBs()
      ? ` (Bs. ${this.totalBs().toFixed(2)})`
      : '';

    const envioStr = shipping
      ? `*Envío:* ${shipping.name}${fee > 0 ? ` (${symbol}${fee})` : ' (Gratis)'}\n`
      : '';
    const direccionStr =
      shipping?.requestCustomerAddress && this.customerAddress().trim()
        ? `*Dirección:* ${this.customerAddress().trim()}\n`
        : '';
    const commentsStr = this.comments() ? `*Comentarios:* ${this.comments()}` : '';
    const paymentStr = this.selectedPaymentMethod()
      ? `*Método de pago:* ${this.selectedPaymentMethod()}\nPor favor compartir los datos para realizar el pago.`
      : '';

    const phoneFull = this.customerFields().phone.visible
      ? `${this.countryCode()} ${this.phone()}`.trim()
      : '';

    const template = this.info()?.whatsappOrderMessage;
    if (template) {
      return template
        .replace(/\{nombre\}/g, this.name().trim() || 'Cliente')
        .replace(/\{telefono\}/g, phoneFull)
        .replace(/\{productos\}/g, productsList.trimEnd())
        .replace(/\{total\}/g, `${symbol}${total}`)
        .replace(/\{totalBs\}/g, totalBsStr)
        .replace(/\{envio\}/g, envioStr)
        .replace(/\{direccion\}/g, direccionStr)
        .replace(/\{comentarios\}/g, commentsStr)
        .replace(/\{metodoPago\}/g, paymentStr);
    }

    let message = `¡Hola! Me gustaría hacer un pedido:\n\n`;
    message += `*Nombre:* ${this.name().trim() || 'Cliente'}\n`;
    if (phoneFull) message += `*Teléfono:* ${phoneFull}\n`;
    message += `\n*Productos:*\n${productsList}`;
    if (fee > 0) message += `\n*Subtotal:* ${symbol}${subtotal}`;
    message += `\n*Total:* ${symbol}${total}${totalBsStr}\n`;
    if (envioStr) message += `\n${envioStr.trimEnd()}`;
    if (direccionStr) message += `\n${direccionStr.trimEnd()}`;
    if (commentsStr) message += `\n\n${commentsStr}`;
    if (paymentStr) message += `\n\n${paymentStr}`;
    return message;
  }

  // --- Post-order actions (confirm / sent) ---
  public readonly copied = signal(false);

  sendWhatsapp() {
    const url = this.pendingWhatsappUrl();
    if (!url) return;
    window.open(url, '_blank');
    this.phase.set('sent');
  }

  async copyMessage() {
    const msg = this.pendingMessage();
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      /* clipboard blocked — the textarea fallback in the template still works */
    }
  }

  viewInvoice() {
    if (this.isPreview) return;
    const id = this.lastOrderId();
    if (id == null) return;
    this.router.navigate(['/order', id, 'invoice'], {
      queryParamsHandling: 'preserve',
    });
  }

  backToStore() {
    if (this.isPreview) return;
    this.phase.set('form');
    this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
  }

  // --- Country dropdown ---
  countryCodes = SUPPORTED_COUNTRIES.map((c) => ({
    iso: c.code,
    code: c.dialCode,
    flag: flagEmoji(c.code),
    label: c.label,
  }));

  public readonly selectedCountry = computed(
    () =>
      this.countryCodes.find((c) => c.iso === this.countryIso()) ??
      this.countryCodes[0]
  );

  selectCountry(country: { iso: string; code: string }) {
    this.userPickedCountry = true;
    this.countryIso.set(country.iso);
    this.countryCode.set(country.code);
    this.countryDropdownOpen.set(false);
  }

  toggleCountryDropdown(event: Event) {
    event.stopPropagation();
    this.countryDropdownOpen.update((v) => !v);
  }

  @HostListener('document:click')
  closeCountryDropdown() {
    if (this.countryDropdownOpen()) this.countryDropdownOpen.set(false);
  }
}

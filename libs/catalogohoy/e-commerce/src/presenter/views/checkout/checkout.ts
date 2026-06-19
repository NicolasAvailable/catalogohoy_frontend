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
import { MetaPixelService } from '@catalogohoy/core';
import {
  flagEmoji,
  ShippingMethod,
  SUPPORTED_COUNTRIES,
} from '@catalogohoy/ecommerce-config';
import {
  IconComponent,
  InputTextComponent,
  QrCodeComponent,
  TextareaComponent,
} from '@ui';
import {
  AppliedCode,
  CartItem,
  resolveDiscount,
} from '../../../domain';
import { CartStore, EcommerceStore } from '../../../infrastructure';

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
    IconComponent,
    InputTextComponent,
    TextareaComponent,
    QrCodeComponent,
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

  public readonly selectedShipping = computed<ShippingMethod | null>(
    () =>
      this.shippingMethods().find((m) => m.id === this.selectedShippingId()) ??
      null
  );

  public readonly shippingFee = computed(
    () => this.selectedShipping()?.fee ?? 0
  );

  public readonly subtotal = computed(() => this.cartStore.totalPrice());

  // --- Discounts ---
  public readonly discountCodeInput = signal('');
  public readonly appliedCode = signal<AppliedCode | null>(null);
  public readonly codeError = signal<string | null>(null);
  public readonly isValidatingCode = signal(false);
  /** Resolved via RPC when the customer's phone changes (first_purchase rules). */
  public readonly isFirstPurchase = signal(false);

  /** Whether the tenant has any first-purchase rule (gates the phone lookup). */
  private readonly hasFirstPurchaseRule = computed(() =>
    (this.info()?.discounts ?? []).some((d) => d.type === 'first_purchase')
  );

  /** The resolved discount for the current cart (automatic rules + applied code). */
  public readonly discount = computed(() =>
    resolveDiscount(this.info()?.discounts ?? [], {
      items: this.cartStore.items().map((i) => ({
        price: i.price,
        quantity: i.quantity,
      })),
      subtotal: this.subtotal(),
      itemCount: this.cartStore.totalItems(),
      isFirstPurchase: this.isFirstPurchase(),
      appliedCode: this.appliedCode(),
    })
  );

  public readonly discountAmount = computed(() => this.discount().amount);
  public readonly hasDiscount = computed(
    () => this.discountAmount() > 0 || this.discount().freeShipping
  );

  /** Shipping fee after a free-shipping discount waives it. */
  public readonly effectiveShippingFee = computed(() =>
    this.discount().freeShipping ? 0 : this.shippingFee()
  );

  public readonly total = computed(() =>
    Math.max(
      0,
      this.subtotal() - this.discountAmount() + this.effectiveShippingFee()
    )
  );

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

    // First-purchase rules need to know if this phone has ordered before. Only
    // hit the RPC when such a rule exists and the phone looks complete; debounce
    // so we don't query on every keystroke.
    effect((onCleanup) => {
      const phone = this.phone();
      const code = this.countryCode();
      if (!this.hasFirstPurchaseRule()) {
        this.isFirstPurchase.set(false);
        return;
      }
      const full = `${code} ${phone}`.replace(/\D/g, '');
      if (full.length < 7) {
        this.isFirstPurchase.set(false);
        return;
      }
      const handle = setTimeout(() => {
        this.ecommerceStore
          .checkFirstPurchase(`${code} ${phone}`)
          .then((first) => this.isFirstPurchase.set(first));
      }, 500);
      onCleanup(() => clearTimeout(handle));
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

  // --- Discount code ---
  async applyDiscountCode() {
    const code = this.discountCodeInput().trim();
    if (!code || this.isValidatingCode()) return;
    this.isValidatingCode.set(true);
    this.codeError.set(null);

    const phoneFull = this.customerFields().phone.visible
      ? `${this.countryCode()} ${this.phone()}`.trim()
      : '';
    const res = await this.ecommerceStore.validateDiscountCode(
      code,
      this.subtotal(),
      phoneFull || undefined
    );
    this.isValidatingCode.set(false);

    if (!res || !res.valid) {
      this.appliedCode.set(null);
      this.codeError.set(this.codeErrorMessage(res?.error, res?.minOrder));
      return;
    }

    this.appliedCode.set({
      id: res.id!,
      name: res.name ?? `Cupón ${code}`,
      code: res.code ?? code,
      valueType: res.valueType ?? 'percent',
      value: res.value ?? 0,
      freeShipping: res.freeShipping ?? false,
    });
    this.codeError.set(null);
  }

  removeDiscountCode() {
    this.appliedCode.set(null);
    this.discountCodeInput.set('');
    this.codeError.set(null);
  }

  private codeErrorMessage(error?: string, minOrder?: number): string {
    switch (error) {
      case 'min_order':
        return `El pedido mínimo para este cupón es ${this.cs()}${minOrder ?? ''}.`;
      case 'usage_limit':
        return 'Este cupón alcanzó su límite de usos.';
      default:
        return 'El cupón no es válido o expiró.';
    }
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
      alert('Este catálogo no tiene un número de WhatsApp configurado.');
      return;
    }

    this.isSubmitting.set(true);

    const items = this.cartStore.items();
    const subtotal = this.subtotal();
    const fee = this.effectiveShippingFee();
    const total = this.total();
    const discount = this.discount();
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
      discount_amount: discount.amount,
      discount_code: discount.code,
      discount_label: discount.label,
    });

    if (!orderResult || orderResult.isLeft()) {
      this.isSubmitting.set(false);
      alert('Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
      return;
    }

    this.lastOrderId.set(orderResult.value.id);

    const message = this.buildWhatsappMessage(
      items,
      subtotal,
      fee,
      total,
      sel,
      discount
    );
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
    shipping: ShippingMethod | null,
    discount: { amount: number; freeShipping: boolean; label: string | null }
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

    // Discount block: label + amount saved, plus a free-shipping note. Includes
    // a trailing newline so the template's {descuento} slot stays compact when
    // there's no discount.
    let descuentoStr = '';
    if (discount.amount > 0) {
      const label = discount.label ? ` (${discount.label})` : '';
      descuentoStr = `*Descuento:*${label} -${symbol}${discount.amount}\n`;
    }
    if (discount.freeShipping) {
      descuentoStr += `*Envío:* ¡Gratis! 🎉\n`;
    }

    const envioStr =
      shipping && !discount.freeShipping
        ? `*Envío:* ${shipping.name}${fee > 0 ? ` (${symbol}${fee})` : ' (Gratis)'}\n`
        : shipping && discount.freeShipping
          ? `*Envío:* ${shipping.name}\n`
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
        .replace(/\{descuento\}/g, descuentoStr)
        .replace(/\{envio\}/g, envioStr)
        .replace(/\{direccion\}/g, direccionStr)
        .replace(/\{comentarios\}/g, commentsStr)
        .replace(/\{metodoPago\}/g, paymentStr);
    }

    let message = `¡Hola! Me gustaría hacer un pedido:\n\n`;
    message += `*Nombre:* ${this.name().trim() || 'Cliente'}\n`;
    if (phoneFull) message += `*Teléfono:* ${phoneFull}\n`;
    message += `\n*Productos:*\n${productsList}`;
    if (discount.amount > 0 || fee > 0) {
      message += `\n*Subtotal:* ${symbol}${subtotal}`;
    }
    if (descuentoStr) message += `\n${descuentoStr.trimEnd()}`;
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

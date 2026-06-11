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
import { CartItem } from '../../../domain';
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

  /** WhatsApp seller button to send the order to (first configured one). */
  public readonly whatsappButton = computed(
    () => this.info()?.whatsappButtons?.find((b) => b.number?.trim()) ?? null
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

    return !this.cartStore.isEmpty();
  }

  private isValidEmail(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  // --- Submit ---
  async onSubmit() {
    if (!this.isValid || this.isSubmitting()) return;
    const button = this.whatsappButton();
    if (!button?.number) {
      alert('Este catálogo no tiene un número de WhatsApp configurado.');
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
    });

    if (!orderResult || orderResult.isLeft()) {
      this.isSubmitting.set(false);
      alert('Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
      return;
    }

    this.lastOrderId.set(orderResult.value.id);

    const message = this.buildWhatsappMessage(items, subtotal, fee, total, sel);
    const whatsappNumber = button.number.replace(/\D/g, '');
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
      productsList += `• ${item.name}${sizeLabel} x${item.quantity} - ${symbol}${item.total}\n`;
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
    const id = this.lastOrderId();
    if (id == null) return;
    this.router.navigate(['/order', id, 'invoice'], {
      queryParamsHandling: 'preserve',
    });
  }

  backToStore() {
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

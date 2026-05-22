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
import { MetaPixelService } from '@catalogohoy/core';
import {
  flagEmoji,
  SUPPORTED_COUNTRIES,
  WhatsappButton,
} from '@catalogohoy/ecommerce-config';
import { IconComponent } from '@ui';
import { CartItem } from '../../../domain';
import { CartStore, EcommerceStore } from '../../../infrastructure';

function isPagoMovil(name: string): boolean {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes('pago movil');
}

@Component({
  selector: 'lib-checkout-drawer',
  imports: [DecimalPipe, FormsModule, IconComponent],
  templateUrl: './checkout-drawer.html',
  styleUrl: './checkout-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutDrawer {
  public readonly cartStore = inject(CartStore);
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cs = this.ecommerceStore.currencySymbol;
  private readonly metaPixel = inject(MetaPixelService);

  public readonly name = signal('');
  public readonly phone = signal('');
  public readonly comments = signal('');
  public readonly countryCode = signal('+58');
  public readonly countryIso = signal('VE');
  public readonly countryDropdownOpen = signal(false);
  public readonly selectedPaymentMethod = signal<string>('');
  public readonly pendingWhatsappUrl = signal<string | null>(null);

  public readonly selectedCountry = computed(
    () =>
      this.countryCodes.find((c) => c.iso === this.countryIso()) ??
      this.countryCodes[0]
  );

  /** True once the customer manually picks a country from the dropdown.
   *  Locks the default-from-catalog effect so we don't overwrite their
   *  choice when the catalog info signal re-emits. */
  private userPickedCountry = false;

  /** Default the phone country to whatever country the seller configured
   *  for this catalog (CatalogInfo.countryCode, ISO-2). Runs reactively
   *  because catalog info loads async — first emission is usually null. */
  private readonly applyCatalogDefaultCountry = effect(() => {
    if (this.userPickedCountry) return;
    const iso = this.ecommerceStore.effectiveCatalogInfo()?.countryCode;
    if (!iso) return;
    const match = this.countryCodes.find((c) => c.iso === iso);
    if (!match) return;
    this.countryIso.set(match.iso);
    this.countryCode.set(match.code);
  });

  public readonly availablePaymentMethods = computed(() => {
    const info = this.ecommerceStore.effectiveCatalogInfo();
    if (!info?.showPaymentMethodsSection || !info.paymentMethods?.length)
      return [];
    if (this.ecommerceStore.isVenezuela()) return info.paymentMethods;
    // Pago móvil is a Venezuela-only payment rail — hide it for other countries.
    return info.paymentMethods.filter((m) => !isPagoMovil(m.name));
  });

  onClose() {
    this.pendingWhatsappUrl.set(null);
    this.cartStore.closeCheckout();
  }

  onBack() {
    this.pendingWhatsappUrl.set(null);
    this.cartStore.closeCheckout();
  }

  onContinueToWhatsApp() {
    const url = this.pendingWhatsappUrl();
    if (!url) return;
    window.open(url, '_blank');
    this.cartStore.closeCheckout();
    this.cartStore.closeCart();
  }

  onKeepShopping() {
    this.pendingWhatsappUrl.set(null);
    this.cartStore.closeCheckout();
    this.cartStore.closeCart();
  }

  async onSubmit(button: WhatsappButton) {
    if (!button.number) {
      alert('Número de WhatsApp no configurado');
      return;
    }

    const items = this.cartStore.items();
    const total = this.cartStore.totalPrice();

    // Guardar pedido en Supabase
    const orderResult = await this.ecommerceStore.createOrder({
      name: this.name(),
      phone: `${this.countryCode()} ${this.phone()}`,
      comments: this.comments(),
      items: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        photo: item.photo,
        sku: item.sku ?? null,
      })),
      total: total,
      payment_method: this.selectedPaymentMethod() || undefined,
    });

    if (orderResult && orderResult.isLeft()) {
      alert('Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
      return;
    }

    const symbol = this.cs();
    const exchangeRate = this.ecommerceStore.exchangeRate();

    // Build product list string
    let productsList = '';
    items.forEach((item: CartItem) => {
      productsList += `• ${item.name} x${item.quantity} - ${symbol}${item.total}\n`;
    });

    // Build total Bs string — Venezuela only (dual-currency is VE-specific)
    let totalBsStr = '';
    if (this.ecommerceStore.isVenezuela() && exchangeRate > 0) {
      const totalBs = (total * exchangeRate).toFixed(2);
      totalBsStr = ` (Bs. ${totalBs})`;
    }

    // Build comments string
    let commentsStr = '';
    if (this.comments()) {
      commentsStr = `*Comentarios:* ${this.comments()}`;
    }

    // Build payment method string
    let paymentStr = '';
    if (this.selectedPaymentMethod()) {
      paymentStr = `*Método de pago:* ${this.selectedPaymentMethod()}\nPor favor compartir los datos para realizar el pago.`;
    }

    // Use custom template from config or fall back to the default
    const customTemplate =
      this.ecommerceStore.effectiveCatalogInfo()?.whatsappOrderMessage;

    let message: string;

    if (customTemplate) {
      message = customTemplate
        .replace(/\{nombre\}/g, this.name())
        .replace(/\{telefono\}/g, `${this.countryCode()} ${this.phone()}`)
        .replace(/\{productos\}/g, productsList.trimEnd())
        .replace(/\{total\}/g, `${symbol}${total}`)
        .replace(/\{totalBs\}/g, totalBsStr)
        .replace(/\{comentarios\}/g, commentsStr)
        .replace(/\{metodoPago\}/g, paymentStr);
    } else {
      message = `¡Hola! Me gustaría hacer un pedido:\n\n`;
      message += `*Nombre:* ${this.name()}\n`;
      message += `*Teléfono:* ${this.countryCode()} ${this.phone()}\n\n`;
      message += `*Productos:*\n${productsList}`;
      message += `\n*Total:* ${symbol}${total}${totalBsStr}`;
      if (commentsStr) message += `\n\n${commentsStr}`;
      if (paymentStr) message += `\n\n${paymentStr}`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = button.number.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    this.metaPixel.trackEvent('Purchase', {
      currency: 'USD',
      value: total,
      num_items: items.length,
    });

    // Clear cart and show success screen with WhatsApp URL
    this.cartStore.clearCart();
    this.pendingWhatsappUrl.set(whatsappUrl);

    // Reset form
    this.name.set('');
    this.phone.set('');
    this.comments.set('');
    this.selectedPaymentMethod.set('');
  }

  get isValid(): boolean {
    const hasName = this.name().trim().length > 0;
    const hasPhone = this.phone().trim().length > 0;
    const methods = this.availablePaymentMethods();
    const hasPayment =
      methods.length === 0 || this.selectedPaymentMethod().length > 0;
    return hasName && hasPhone && hasPayment;
  }

  // Matches the countries in the catalog editor's Ubicación select so the
  // customer can pick any supported country. `iso` is the track key — some
  // countries (US/CA, JM/PR/DO/BS/TT/BB) share the same dial code, so we
  // can't track by `code` alone.
  countryCodes = SUPPORTED_COUNTRIES.map((c) => ({
    iso: c.code,
    code: c.dialCode,
    flag: flagEmoji(c.code),
    label: c.label,
  }));

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

  // Close the dropdown when the user clicks/touches anywhere outside.
  // Angular's HostListener on `document:click` fires after the toggle button's
  // own click (which stops propagation), so clicks on the trigger don't
  // re-close what they just opened.
  @HostListener('document:click')
  closeCountryDropdown() {
    if (this.countryDropdownOpen()) this.countryDropdownOpen.set(false);
  }
}

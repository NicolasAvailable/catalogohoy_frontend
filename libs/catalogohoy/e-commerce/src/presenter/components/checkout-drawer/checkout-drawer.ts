import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MetaPixelService } from '@catalogohoy/core';
import { WhatsappButton } from '@catalogohoy/ecommerce-config';
import { IconComponent } from '@ui';
import { CartItem } from '../../../domain';
import { CartStore, EcommerceStore } from '../../../infrastructure';

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
  public readonly selectedPaymentMethod = signal<string>('');
  public readonly pendingWhatsappUrl = signal<string | null>(null);

  public readonly availablePaymentMethods = computed(() => {
    const info = this.ecommerceStore.effectiveCatalogInfo();
    if (!info?.showPaymentMethodsSection || !info.paymentMethods?.length)
      return [];
    return info.paymentMethods;
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

    // Build total Bs string
    let totalBsStr = '';
    if (exchangeRate > 0) {
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

  countryCodes = [
    { code: '+57', flag: '🇨🇴' },
    { code: '+58', flag: '🇻🇪' },
    { code: '+1', flag: '🇺🇸' },
    { code: '+52', flag: '🇲🇽' },
    { code: '+34', flag: '🇪🇸' },
    { code: '+54', flag: '🇦🇷' },
    { code: '+56', flag: '🇨🇱' },
    { code: '+51', flag: '🇵🇪' },
    { code: '+593', flag: '🇪🇨' },
  ];

  setCountryCode(code: string) {
    this.countryCode.set(code);
  }
}

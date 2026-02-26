import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
      })),
      total: total,
      payment_method: this.selectedPaymentMethod() || undefined,
    });

    if (orderResult && orderResult.isLeft()) {
      alert('Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
      return;
    }

    let message = `¡Hola! Me gustaría hacer un pedido:\n\n`;
    message += `*Nombre:* ${this.name()}\n`;
    message += `*Teléfono:* ${this.countryCode()} ${this.phone()}\n\n`;
    message += `*Productos:*\n`;

    items.forEach((item: CartItem) => {
      message += `• ${item.name} x${item.quantity} - $${item.total}\n`;
    });

    message += `\n*Total:* $${total}`;

    if (this.comments()) {
      message += `\n\n*Comentarios:* ${this.comments()}`;
    }

    if (this.selectedPaymentMethod()) {
      message += `\n\n*Método de pago:* ${this.selectedPaymentMethod()}`;
      message += `\nPor favor compartir los datos para realizar el pago.`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = button.number.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

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

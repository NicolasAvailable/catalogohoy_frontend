import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import { CartItem } from '../../../domain';
import { CartStore, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-checkout-drawer',
  imports: [FormsModule, IconComponent],
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

  onClose() {
    this.cartStore.closeCheckout();
  }

  onBack() {
    this.cartStore.closeCheckout();
  }

  async onSubmit() {
    const catalogInfo = this.ecommerceStore.catalogInfo();
    if (!catalogInfo?.whatsapp) {
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
      })),
      total: total,
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

    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = catalogInfo.whatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');

    // Clear cart after sending
    this.cartStore.clearCart();
    this.cartStore.closeCheckout();
    this.cartStore.closeCart();

    // Reset form
    this.name.set('');
    this.phone.set('');
    this.comments.set('');
  }

  get isValid(): boolean {
    return this.name().trim().length > 0 && this.phone().trim().length > 0;
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

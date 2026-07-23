import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  DialogComponent,
  IconComponent,
  InputPhoneComponent,
  InputSearchComponent,
  InputTextComponent,
} from '@ui';
import { ChatService, SavedCustomer } from '../../../infrastructure/chat.service';
import { ChatStore } from '../../../infrastructure/chat.store';
import { PhonePlusPipe } from '../phone-plus.pipe';

/** Diálogo "Nuevo chat": inicia una conversación de WhatsApp con un cliente
 *  guardado (tabla customers) o con un número nuevo. Si ya existe un chat con
 *  ese teléfono, lo reabre en vez de duplicarlo (ChatStore.startChat). */
@Component({
  selector: 'lib-new-chat-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    DialogComponent,
    IconComponent,
    InputPhoneComponent,
    InputSearchComponent,
    InputTextComponent,
    PhonePlusPipe,
    TranslocoPipe,
  ],
  templateUrl: './new-chat-dialog.html',
})
export class NewChatDialogComponent {
  private readonly chatStore = inject(ChatStore);
  private readonly chatService = inject(ChatService);
  private readonly tenantStore = inject(TenantStore);
  private readonly toast = inject(ToastService);

  @ViewChild(DialogComponent) private dialog!: DialogComponent;

  protected readonly customers = signal<SavedCustomer[]>([]);
  protected readonly loadingCustomers = signal(false);
  protected readonly search = signal('');
  protected readonly newPhone = signal('');
  protected readonly newName = signal('');
  /** Teléfono del contacto cuyo chat se está creando (deshabilita la fila). */
  protected readonly startingPhone = signal<string | null>(null);

  protected readonly filteredCustomers = computed(() => {
    const q = this.search().toLowerCase().trim();
    const digits = q.replace(/\D/g, '');
    if (!q) return this.customers();
    return this.customers().filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nickname?.toLowerCase().includes(q) ?? false) ||
        (digits.length > 0 && c.phone.replace(/\D/g, '').includes(digits))
    );
  });

  protected readonly newPhoneValid = computed(
    () => this.newPhone().replace(/\D/g, '').length >= 8
  );

  async open(): Promise<void> {
    this.search.set('');
    this.newPhone.set('');
    this.newName.set('');
    this.startingPhone.set(null);
    this.dialog.show();

    this.loadingCustomers.set(true);
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) {
      const result = await this.chatService.getSavedCustomers(tenantId);
      this.customers.set(result.isRight() ? result.value : []);
    }
    this.loadingCustomers.set(false);
  }

  protected async startWith(name: string, phone: string): Promise<void> {
    if (this.startingPhone()) return;
    this.startingPhone.set(phone);

    const chatId = await this.chatStore.startChat(name, phone);
    this.startingPhone.set(null);

    if (chatId === null) {
      this.toast.error(new Exception('No se pudo iniciar la conversación'));
      return;
    }
    this.dialog.hide();
    this.chatStore.selectChat(chatId);
  }

  protected startWithNewNumber(): void {
    if (!this.newPhoneValid()) return;
    this.startWith(this.newName().trim(), this.newPhone());
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
}

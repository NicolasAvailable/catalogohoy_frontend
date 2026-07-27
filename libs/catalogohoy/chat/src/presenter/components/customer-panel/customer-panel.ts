import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { PhonePlusPipe } from '../phone-plus.pipe';
import { AccordionModule } from 'primeng/accordion';
import { ProfileStore } from '@catalogohoy/profile';
import { TeamStore } from '@catalogohoy/teams';
import { OrderDetailModal, OrderStore } from '@catalogohoy/order';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import {
  DialogService,
  dialogConfig,
  IconComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
} from '@ui';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ChatNote } from '../../../domain';
import {
  ChatService,
  CustomerOrderSummary,
} from '../../../infrastructure/chat.service';
import { ChatStore } from '../../../infrastructure/chat.store';

/** Right-hand CRM ficha for the selected conversation: pipeline status,
 *  assignment, internal notes thread, and the customer's past orders. */
@Component({
  selector: 'lib-customer-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AccordionModule,
    IconComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    TranslocoPipe,
    PhonePlusPipe,
  ],
  templateUrl: './customer-panel.html',
  styleUrl: './customer-panel.css',
})
export class CustomerPanelComponent {
  protected readonly chatStore = inject(ChatStore);
  protected readonly teamStore = inject(TeamStore);
  private readonly chatService = inject(ChatService);
  private readonly profileStore = inject(ProfileStore);
  private readonly orderStore = inject(OrderStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(ToastService);
  private currencyLoaded = false;

  protected readonly chat = this.chatStore.selectedChat;
  protected readonly orders = signal<CustomerOrderSummary[]>([]);
  protected readonly noteDraft = signal('');

  /** Cerrar la ficha cuando se muestra como overlay en móvil. */
  public readonly closed = output<void>();

  /** Renombrar el contacto/lead desde la ficha. */
  protected readonly renaming = signal(false);
  protected readonly nameDraft = signal('');

  // ------------------------------------------------------ guardar cliente ---
  /** La caché de clientes guardados vive en el ChatStore (compartida con la
   *  lista y el header para los apodos); acá solo se deriva. */
  protected readonly customersLoaded = computed(
    () => this.chatStore.savedCustomers() !== null
  );

  /** Cliente guardado que matchea el teléfono del chat abierto (por dígitos). */
  protected readonly savedCustomer = computed(() => {
    const phone = this.chat()?.customerPhone;
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits
      ? this.chatStore.savedCustomerByDigits().get(digits) ?? null
      : null;
  });

  protected readonly saveMenuOpen = signal(false);
  protected readonly saveNameDraft = signal('');
  protected readonly saveNicknameDraft = signal('');
  protected readonly savingCustomer = signal(false);

  toggleSaveMenu(currentName: string): void {
    if (!this.saveMenuOpen()) {
      this.saveNameDraft.set((currentName ?? '').trim());
      this.saveNicknameDraft.set('');
    }
    this.saveMenuOpen.update((v) => !v);
  }

  async confirmSaveCustomer(): Promise<void> {
    const c = this.chat();
    const name = this.saveNameDraft().trim();
    if (!c?.customerPhone || !name || this.savingCustomer()) return;

    this.savingCustomer.set(true);
    const result = await this.chatService.saveCustomerFromChat(
      c.tenantId,
      name,
      c.customerPhone,
      this.saveNicknameDraft().trim() || null
    );
    this.savingCustomer.set(false);

    if (result.isLeft()) {
      this.toast.error(new Exception('No se pudo guardar el cliente'));
      return;
    }
    this.chatStore.addSavedCustomer(result.value);
    this.saveMenuOpen.set(false);
    // Mantener el nombre del chat sincronizado con el que se guardó.
    if (name !== c.customerName) this.chatStore.renameChat(c.id, name);
    this.toast.success('Cliente guardado');
  }

  startRename(current: string): void {
    this.nameDraft.set(current ?? '');
    this.renaming.set(true);
  }

  saveRename(chatId: number): void {
    const name = this.nameDraft().trim();
    if (!name) return;
    this.chatStore.renameChat(chatId, name);
    this.renaming.set(false);
  }

  /** Collapsible ficha sections that start open (PrimeNG accordion, multiple). */
  protected accordionValue: string[] = ['info', 'orders', 'notes'];

  protected readonly statusOptions = computed(() =>
    this.chatStore.pipelineStatuses().map((s) => ({ label: s.name, value: s.key }))
  );

  protected readonly assigneeOptions = computed(() => {
    const members = this.teamStore
      .acceptedMembers()
      .filter((m) => m.userId !== null)
      .map((m) => ({
        label:
          `${m.userName ?? ''} ${m.userLastName ?? ''}`.trim() ||
          m.invitedEmail,
        value: m.userId,
      }));

    // La cuenta propia (owner o miembro) también es asignable — acceptedMembers
    // no incluye al dueño del catálogo.
    const profile = this.profileStore.profile();
    const myId = typeof profile.id === 'number' ? profile.id : null;
    const mine =
      myId !== null && !members.some((m) => m.value === myId)
        ? [{ label: `${profile.name?.trim() || profile.email} (Tú)`, value: myId as number | null }]
        : [];

    return [
      { label: 'Sin asignar', value: null as number | null },
      ...mine,
      ...members,
    ];
  });

  constructor() {
    // Load CRM config + team once.
    this.chatStore.loadCrmConfig();
    this.teamStore.load();

    // Whenever the selected conversation changes, pull its customer's orders.
    // La lista de clientes guardados se carga UNA sola vez (caché en memoria).
    effect(() => {
      const c = this.chat();
      this.saveMenuOpen.set(false);
      if (!c) {
        this.orders.set([]);
        return;
      }
      if (!this.currencyLoaded) {
        this.tenantCurrency.load(c.tenantId);
        this.currencyLoaded = true;
      }
      this.chatService
        .getCustomerOrders(c.tenantId, c.customerPhone)
        .then((res) => this.orders.set(res.isRight() ? res.value : []));

      this.chatStore.loadSavedCustomers();
    });
  }

  /** Open the shared order-detail modal (same one as the Ordenes module). */
  async openOrder(orderId: number): Promise<void> {
    const order = await this.orderStore.getOrderById(orderId);
    if (!order) return;
    this.dialogService.open(
      OrderDetailModal,
      dialogConfig({
        data: {
          order,
          currencySymbol: this.tenantCurrency.displaySymbol() || '$',
          showDualBs: this.tenantCurrency.showDualCurrency(),
        },
        showHeader: false,
        style: { width: '72rem', maxWidth: '95vw' },
        contentStyle: { padding: '0', overflow: 'hidden' },
      })
    );
  }

  onStatusChange(key: string | null): void {
    const c = this.chat();
    if (c) this.chatStore.setStatus(c.id, key);
  }

  onAssigneeChange(userId: number | null): void {
    const c = this.chat();
    if (c) this.chatStore.assignChat(c.id, userId);
  }

  addNote(): void {
    const text = this.noteDraft().trim();
    const c = this.chat();
    if (!text || !c) return;
    const note: ChatNote = {
      author: this.profileStore.profile().name?.trim() || 'Equipo',
      text,
      createdAt: new Date().toISOString(),
    };
    this.chatStore.addNote(c.id, note);
    this.noteDraft.set('');
  }

  /** Enter sends the note; Shift+Enter inserts a newline. */
  onNoteKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.addNote();
    }
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  initial(name: string | null): string {
    return (name?.trim()?.[0] ?? '?').toUpperCase();
  }

  waLink(phone: string): string {
    return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;
  }

  statusColor(key: string | null): string {
    return (
      this.chatStore.pipelineStatuses().find((s) => s.key === key)?.color ??
      '#cbd5e1'
    );
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  orderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pendiente',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return map[status] ?? status;
  }
}

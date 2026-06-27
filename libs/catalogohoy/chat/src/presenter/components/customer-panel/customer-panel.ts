import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ProfileStore } from '@catalogohoy/profile';
import { TeamStore } from '@catalogohoy/teams';
import {
  IconComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
} from '@ui';
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
  ],
  templateUrl: './customer-panel.html',
  styleUrl: './customer-panel.css',
})
export class CustomerPanelComponent {
  protected readonly chatStore = inject(ChatStore);
  protected readonly teamStore = inject(TeamStore);
  private readonly chatService = inject(ChatService);
  private readonly profileStore = inject(ProfileStore);

  protected readonly chat = this.chatStore.selectedChat;
  protected readonly orders = signal<CustomerOrderSummary[]>([]);
  protected readonly noteDraft = signal('');

  /** Collapsible ficha sections that start open (PrimeNG accordion, multiple). */
  protected accordionValue: string[] = ['info', 'orders', 'notes'];

  protected readonly statusOptions = computed(() =>
    this.chatStore.pipelineStatuses().map((s) => ({ label: s.name, value: s.key }))
  );

  protected readonly assigneeOptions = computed(() => [
    { label: 'Sin asignar', value: null as number | null },
    ...this.teamStore
      .acceptedMembers()
      .filter((m) => m.userId !== null)
      .map((m) => ({
        label:
          `${m.userName ?? ''} ${m.userLastName ?? ''}`.trim() ||
          m.invitedEmail,
        value: m.userId,
      })),
  ]);

  constructor() {
    // Load CRM config + team once.
    this.chatStore.loadCrmConfig();
    this.teamStore.load();

    // Whenever the selected conversation changes, pull its customer's orders.
    effect(() => {
      const c = this.chat();
      if (!c) {
        this.orders.set([]);
        return;
      }
      this.chatService
        .getCustomerOrders(c.tenantId, c.customerPhone)
        .then((res) => this.orders.set(res.isRight() ? res.value : []));
    });
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

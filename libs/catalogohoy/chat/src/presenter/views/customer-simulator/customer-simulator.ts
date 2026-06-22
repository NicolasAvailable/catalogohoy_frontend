import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { IconComponent } from '@ui';
import { ChatMessage } from '../../../domain';
import { ChatDemoService } from '../../../infrastructure/chat-demo.service';

const LS_KEY = 'wa-demo-customer';

/** Public, anon-accessible "customer" side of the chat — stands in for a real
 *  WhatsApp user while Meta approval is pending. Open this on a phone, open the
 *  admin inbox on a desktop, and chat live: customer messages reach the inbox
 *  via realtime; agent replies show here via polling. */
@Component({
  selector: 'lib-customer-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './customer-simulator.html',
  styleUrl: './customer-simulator.css',
})
export default class CustomerSimulatorComponent implements OnDestroy {
  private readonly demo = inject(ChatDemoService);

  /** Tenant the customer is messaging — subdomain in prod, path slug in dev,
   *  or an explicit ?tenant= override. */
  private readonly slug =
    new URLSearchParams(window.location.search).get('tenant') ||
    getTenantSlugFromUrl() ||
    '';

  readonly name = signal('');
  readonly phone = signal('');
  readonly started = signal(false);

  readonly draft = signal('');
  readonly messages = signal<ChatMessage[]>([]);
  readonly chatId = signal<number | null>(null);
  readonly isSending = signal(false);

  readonly canStart = computed(
    () => this.name().trim().length > 1 && this.phone().trim().length >= 7
  );

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly scrollEl =
    viewChild<ElementRef<HTMLDivElement>>('thread');

  constructor() {
    // Restore a previous demo session so a reload keeps the conversation.
    const saved = this.readSaved();
    if (saved) {
      this.name.set(saved.name);
      this.phone.set(saved.phone);
      if (saved.chatId) {
        this.chatId.set(saved.chatId);
        this.started.set(true);
        this.startPolling();
      }
    }

    effect(() => {
      if (this.messages().length) {
        setTimeout(() => this.scrollToBottom(), 0);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  start(): void {
    if (!this.canStart()) return;
    this.started.set(true);
    this.persist();
    this.startPolling();
  }

  async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.isSending() || !this.slug) return;
    this.isSending.set(true);
    this.draft.set('');

    const res = await this.demo.sendCustomerMessage(
      this.slug,
      this.phone().trim(),
      this.name().trim(),
      text
    );
    this.isSending.set(false);

    if (res.isRight()) {
      if (this.chatId() === null) {
        this.chatId.set(res.value);
        this.persist();
        this.startPolling();
      }
      await this.refresh();
    } else {
      this.draft.set(text);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  /** Customer's own messages are stored as is_mine=false (agent perspective);
   *  flip it so they render on the right here. */
  isFromCustomer(msg: ChatMessage): boolean {
    return !msg.isMine;
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // --------------------------------------------------------------- internals ---

  private async refresh(): Promise<void> {
    const id = this.chatId();
    if (id === null) return;
    const res = await this.demo.getMessages(id, this.phone().trim());
    if (res.isRight()) this.messages.set(res.value);
  }

  private startPolling(): void {
    this.stopPolling();
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), 2000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scrollToBottom(): void {
    const el = this.scrollEl()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private persist(): void {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        name: this.name(),
        phone: this.phone(),
        chatId: this.chatId(),
        slug: this.slug,
      })
    );
  }

  private readSaved(): {
    name: string;
    phone: string;
    chatId: number | null;
    slug: string;
  } | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Don't restore a session that belongs to a different tenant.
      if (parsed.slug && parsed.slug !== this.slug) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

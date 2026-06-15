import { Component, inject, OnInit } from '@angular/core';
import { WhatsAppSetupComponent, WhatsAppStore } from '@catalogohoy/whatsapp';
import { SkeletonDirective } from '@ui';
import { ChatLayoutComponent } from '../chat-layout/chat-layout';

@Component({
  selector: 'lib-conversations',
  standalone: true,
  imports: [ChatLayoutComponent, WhatsAppSetupComponent, SkeletonDirective],
  host: { class: 'flex-1 flex min-h-0 overflow-hidden' },
  template: `
    @if (whatsAppStore.isLoading()) {
      <div class="flex flex-col gap-4 w-full p-6">
        <div [skeleton]="true" class="h-8 w-64 rounded-md"></div>
        <div [skeleton]="true" class="h-64 w-full rounded-md"></div>
      </div>
    } @else if (!whatsAppStore.hasActiveAccount()) {
      <lib-whatsapp-setup mode="fullpage" />
    } @else {
      <lib-chat-layout />
    }
  `,
})
export class ConversationsComponent implements OnInit {
  readonly whatsAppStore = inject(WhatsAppStore);

  ngOnInit() {
    this.whatsAppStore.loadAccounts();
  }
}

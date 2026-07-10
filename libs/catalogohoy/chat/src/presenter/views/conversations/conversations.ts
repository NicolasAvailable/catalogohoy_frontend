import { Component, inject, OnInit } from '@angular/core';
import { WhatsAppSetupComponent, WhatsAppStore } from '@catalogohoy/whatsapp';
import { SkeletonDirective } from '@ui';
import { ChatLayoutComponent } from '../chat-layout/chat-layout';

@Component({
  selector: 'lib-conversations',
  standalone: true,
  imports: [ChatLayoutComponent, WhatsAppSetupComponent, SkeletonDirective],
  // -m-4 cancels the admin layout's px-4 py-4 wrapper so the chat module sits
  // edge-to-edge (full-bleed inbox, like Fuse) without a card/border.
  host: { class: 'flex-1 flex min-h-0 overflow-hidden -m-4' },
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

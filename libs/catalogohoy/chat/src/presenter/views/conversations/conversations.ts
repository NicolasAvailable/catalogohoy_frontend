import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { WhatsAppStore } from '@catalogohoy/whatsapp';
import { IconComponent } from '@ui';
import { ChatStore } from '../../../infrastructure/chat.store';
import { ChatLayoutComponent } from '../chat-layout/chat-layout';

@Component({
  selector: 'lib-conversations',
  standalone: true,
  imports: [ChatLayoutComponent, RouterLink, IconComponent, TranslocoPipe],
  // -m-4 cancels the admin layout's px-4 py-4 wrapper so the chat module sits
  // edge-to-edge (full-bleed inbox, like Fuse) without a card/border.
  host: { class: 'flex-1 flex min-h-0 overflow-hidden -m-4' },
  template: `
    @if (whatsAppStore.isLoading() || (chatStore.isLoading() && !chatStore.chats().length)) {
      <!-- Skeleton con la forma real del inbox: columna de chats + conversación
           (en móvil sólo la lista, como el layout real). -->
      <div class="flex-1 flex h-full w-full overflow-hidden animate-pulse">
        <div class="w-full lg:w-[300px] shrink-0 lg:border-r border-grey-50 flex flex-col gap-3 px-4 pt-5">
          <div class="h-7 w-24 bg-grey-100 rounded-md"></div>
          <div class="h-10 w-full bg-grey-50 rounded-lg"></div>
          <div class="flex flex-col gap-1 mt-1">
            @for (_ of [1, 2, 3, 4, 5, 6, 7]; track $index) {
              <div class="flex items-center gap-3.5 px-2 py-3">
                <div class="w-12 h-12 rounded-full bg-grey-50 shrink-0"></div>
                <div class="flex-1 flex flex-col gap-2">
                  <div class="h-3.5 w-28 bg-grey-50 rounded"></div>
                  <div class="h-3 w-40 bg-grey-50 rounded"></div>
                </div>
              </div>
            }
          </div>
        </div>
        <div class="hidden lg:flex flex-1 flex-col bg-lino-400 min-w-0">
          <div class="h-16 shrink-0 bg-white border-b border-grey-50 flex items-center gap-3 px-4">
            <div class="w-9 h-9 rounded-full bg-grey-50 shrink-0"></div>
            <div class="h-3.5 w-32 bg-grey-50 rounded"></div>
          </div>
          <div class="flex-1 px-6 py-6 flex flex-col gap-2">
            <div class="flex justify-start"><div class="h-9 w-52 bg-grey-100/70 rounded-2xl rounded-bl-md"></div></div>
            <div class="flex justify-start"><div class="h-14 w-64 bg-grey-100/70 rounded-2xl rounded-bl-md"></div></div>
            <div class="flex justify-end mt-3"><div class="h-9 w-44 bg-primary-100/60 rounded-2xl rounded-br-md"></div></div>
            <div class="flex justify-start mt-3"><div class="h-9 w-56 bg-grey-100/70 rounded-2xl rounded-bl-md"></div></div>
          </div>
          <div class="h-24 shrink-0 bg-white border-t border-grey-50 flex items-center px-4">
            <div class="h-12 w-full bg-grey-50 rounded-xl"></div>
          </div>
        </div>
      </div>
    } @else if (!whatsAppStore.hasActiveAccount() && chatStore.chats().length === 0) {
      <!-- Sin canal Y sin historial: si hay chats de un canal desvinculado, la
           bandeja se muestra igual (solo lectura en ese canal). -->
      <!-- Sin canal conectado: invitar a conectar antes de mostrar la bandeja. -->
      <div class="flex-1 flex flex-col items-center justify-center gap-5 bg-lino-400 px-6 text-center">
        <!-- Cluster con los logos de los canales conectables -->
        <div class="flex items-center -space-x-4 mb-1">
          <span class="w-20 h-20 rounded-full bg-white border border-grey-100 shadow-sm flex items-center justify-center -rotate-6">
            <img src="/images/whatsapp.svg" alt="WhatsApp" class="w-10 h-10" />
          </span>
          <span class="w-24 h-24 rounded-full bg-white border border-grey-100 shadow-md flex items-center justify-center z-10">
            <img src="/images/instagram.svg" alt="Instagram" class="w-12 h-12" />
          </span>
          <span class="w-20 h-20 rounded-full bg-white border border-grey-100 shadow-sm flex items-center justify-center rotate-6">
            <img src="/images/tiktok-logo.svg" alt="TikTok" class="w-10 h-10" />
          </span>
        </div>
        <h2 class="text-2xl font-bold text-grey-800">
          {{ 'Todavía no has conectado ningún canal' | transloco }}
        </h2>
        <p class="text-base text-grey-400 max-w-lg leading-relaxed">
          {{ 'Conecta tu número de WhatsApp o tus cuentas de Instagram y TikTok para recibir y responder los mensajes de tus clientes desde una sola bandeja.' | transloco }}
        </p>
        <a
          routerLink="/admin/chat/connect"
          class="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary-500 text-white text-base font-semibold hover:bg-primary-600 transition-colors"
        >
          {{ 'Conectar canales' | transloco }}
          <ui-icon name="arrow-right" size="18" />
        </a>
      </div>
    } @else {
      <lib-chat-layout />
    }
  `,
})
export class ConversationsComponent implements OnInit {
  readonly whatsAppStore = inject(WhatsAppStore);
  readonly chatStore = inject(ChatStore);

  ngOnInit() {
    this.whatsAppStore.loadAccounts();
    // Los chats se cargan acá (y no solo en el layout) porque el gating del
    // empty state necesita saber si hay historial de canales desvinculados.
    this.chatStore.loadChats();
  }
}

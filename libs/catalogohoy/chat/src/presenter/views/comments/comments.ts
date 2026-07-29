import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { CommentsStore } from '../../../infrastructure/comments.store';
import { SocialCommentChannel } from '../../../domain';

// Bandeja de comentarios de posts (IG + FB), estilo chat: lista de hilos a la
// izquierda; a la derecha la conversación con el POST anclado arriba (como el
// "mensaje original"), el comentario del cliente como burbuja entrante y
// nuestras respuestas como burbujas salientes + composer para responder.
@Component({
  selector: 'lib-comments',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslocoPipe],
  host: { class: 'flex-1 flex min-h-0 overflow-hidden -m-4' },
  template: `
    @if (store.isLoading() && !store.comments().length) {
      <div class="flex-1 flex bg-lino-400 animate-pulse">
        <div class="w-full lg:w-[340px] shrink-0 lg:border-r border-grey-50 bg-white flex flex-col gap-2 px-4 pt-5">
          <div class="h-7 w-32 bg-grey-100 rounded"></div>
          @for (_ of [1, 2, 3, 4, 5]; track $index) {
            <div class="flex items-center gap-3 py-3">
              <div class="w-11 h-11 rounded bg-grey-50 shrink-0"></div>
              <div class="flex-1 flex flex-col gap-2">
                <div class="h-3 w-24 bg-grey-50 rounded"></div>
                <div class="h-3 w-40 bg-grey-50 rounded"></div>
              </div>
            </div>
          }
        </div>
      </div>
    } @else if (!store.threads().length) {
      <div class="flex-1 flex flex-col items-center justify-center gap-4 bg-lino-400 px-6 text-center">
        <span class="text-5xl">💬</span>
        <h2 class="text-2xl font-bold text-grey-800">
          {{ 'Todavía no hay comentarios' | transloco }}
        </h2>
        <p class="text-base text-grey-400 max-w-lg leading-relaxed">
          {{ 'Los comentarios de tus posts de Instagram y Facebook van a aparecer acá como un chat, para que los respondas.' | transloco }}
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
      <!-- ═══ Panel izquierdo: lista de hilos ═══ -->
      <div
        class="w-full lg:w-[340px] shrink-0 lg:border-r border-grey-50 bg-white flex flex-col min-h-0"
        [class.max-lg:hidden]="selectedId() !== null"
      >
        <div class="shrink-0 px-4 pt-5 pb-3 border-b border-grey-50">
          <h1 class="text-xl font-bold text-grey-800 mb-3">{{ 'Comentarios' | transloco }}</h1>
          <div class="flex items-center gap-1.5">
            @for (f of filters; track f.key) {
              <button
                type="button"
                (click)="filter.set(f.key)"
                class="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                [class.bg-primary-500]="filter() === f.key"
                [class.text-white]="filter() === f.key"
                [class.bg-grey-50]="filter() !== f.key"
                [class.text-grey-500]="filter() !== f.key"
              >
                {{ f.label | transloco }}
              </button>
            }
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          @for (c of filteredThreads(); track c.id) {
            <button
              type="button"
              (click)="select(c.id)"
              class="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-grey-50/70 hover:bg-grey-50/60 transition-colors"
              [class.bg-primary-50]="selectedId() === c.id"
            >
              <div class="relative shrink-0">
                @if (c.postThumbnailUrl) {
                  <img [src]="c.postThumbnailUrl" alt="" class="w-11 h-11 rounded object-cover bg-grey-50" />
                } @else {
                  <div class="w-11 h-11 rounded bg-grey-100 flex items-center justify-center text-lg">📝</div>
                }
                <span
                  class="absolute -bottom-1 -right-1 px-1 rounded text-[0.55rem] font-bold text-white"
                  [class.bg-pink-500]="c.channel === 'instagram'"
                  [class.bg-blue-600]="c.channel === 'facebook'"
                >
                  {{ c.channel === 'instagram' ? 'IG' : 'FB' }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-grey-800 truncate">
                  {{ c.authorName || c.authorUsername || ('Alguien' | transloco) }}
                </p>
                <p class="text-xs text-grey-400 truncate">{{ c.text }}</p>
              </div>
              @if (c.status !== 'replied') {
                <span class="w-2 h-2 rounded-full bg-primary-500 shrink-0"></span>
              }
            </button>
          }
        </div>
      </div>

      <!-- ═══ Panel derecho: conversación ═══ -->
      <div
        class="flex-1 flex flex-col min-h-0 bg-lino-400"
        [class.max-lg:hidden]="selectedId() === null"
      >
        @if (selected(); as c) {
          <!-- Header -->
          <div class="h-16 shrink-0 bg-white border-b border-grey-50 flex items-center gap-3 px-4">
            <button type="button" (click)="selectedId.set(null)" class="lg:hidden text-grey-500">
              <ui-icon name="arrow-left" size="20" />
            </button>
            <span
              class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              [class.bg-pink-500]="c.channel === 'instagram'"
              [class.bg-blue-600]="c.channel === 'facebook'"
            >
              {{ c.channel === 'instagram' ? 'IG' : 'FB' }}
            </span>
            <div class="min-w-0">
              <p class="text-sm font-bold text-grey-800 truncate">
                {{ c.authorName || c.authorUsername || ('Alguien' | transloco) }}
              </p>
              <p class="text-xs text-grey-400">{{ 'Comentario en tu publicación' | transloco }}</p>
            </div>
          </div>

          <!-- Cuerpo: post anclado + burbujas -->
          <div class="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3">
            <!-- Post anclado (el "mensaje original") -->
            <div class="self-center w-full max-w-md bg-white border border-grey-100 rounded-xl p-3 flex gap-3 shadow-sm">
              @if (c.postThumbnailUrl) {
                <img [src]="c.postThumbnailUrl" alt="" class="w-16 h-16 rounded-lg object-cover bg-grey-50 shrink-0" />
              } @else {
                <div class="w-16 h-16 rounded-lg bg-grey-100 flex items-center justify-center text-2xl shrink-0">📝</div>
              }
              <div class="min-w-0 flex-1">
                <p class="text-[0.7rem] font-semibold text-grey-400 uppercase tracking-wide mb-0.5">
                  {{ 'Tu publicación' | transloco }}
                </p>
                <p class="text-sm text-grey-600 line-clamp-3">
                  {{ c.postCaption || ('Sin descripción' | transloco) }}
                </p>
                @if (c.postPermalink) {
                  <a [href]="c.postPermalink" target="_blank" rel="noopener noreferrer"
                     class="text-xs text-primary-600 hover:underline mt-1 inline-block">
                    {{ 'Ver publicación' | transloco }} ↗
                  </a>
                }
              </div>
            </div>

            <!-- Comentario del cliente (entrante) -->
            <div class="flex justify-start">
              <div class="max-w-[75%] bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                <p class="text-sm text-grey-800 whitespace-pre-wrap">{{ c.text }}</p>
              </div>
            </div>

            <!-- Nuestras respuestas (salientes) -->
            @for (r of selectedReplies(); track r.id) {
              <div class="flex justify-end">
                <div class="max-w-[75%] bg-primary-500 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                  <p class="text-sm whitespace-pre-wrap">{{ r.text }}</p>
                </div>
              </div>
            }
          </div>

          <!-- Composer -->
          <div class="shrink-0 bg-white border-t border-grey-50 px-4 py-3 flex items-end gap-2">
            <textarea
              rows="1"
              [value]="replyDraft()"
              (input)="replyDraft.set($any($event.target).value)"
              [placeholder]="'Responder el comentario…' | transloco"
              class="flex-1 resize-none rounded-xl border border-grey-100 px-4 py-2.5 text-sm max-h-32 focus:outline-none focus:border-primary-400"
            ></textarea>
            <button
              type="button"
              (click)="send()"
              [disabled]="store.replyingId() === c.id || !replyDraft().trim()"
              class="shrink-0 h-11 px-5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50"
            >
              {{ (store.replyingId() === c.id ? 'Enviando…' : 'Responder') | transloco }}
            </button>
          </div>
          @if (store.error()) {
            <p class="text-center text-red-500 text-xs pb-2">{{ store.error() }}</p>
          }
        } @else {
          <div class="flex-1 hidden lg:flex flex-col items-center justify-center gap-2 text-grey-400">
            <span class="text-4xl">💬</span>
            <p>{{ 'Elegí un comentario para responder' | transloco }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class CommentsComponent implements OnInit {
  readonly store = inject(CommentsStore);
  readonly selectedId = signal<number | null>(null);
  readonly filter = signal<'all' | SocialCommentChannel>('all');
  readonly replyDraft = signal('');

  readonly filters = [
    { key: 'all' as const, label: 'Todos' },
    { key: 'instagram' as const, label: 'Instagram' },
    { key: 'facebook' as const, label: 'Facebook' },
  ];

  readonly filteredThreads = computed(() => {
    const f = this.filter();
    const threads = this.store.threads();
    return f === 'all' ? threads : threads.filter((c) => c.channel === f);
  });

  readonly selected = computed(
    () => this.store.threads().find((c) => c.id === this.selectedId()) ?? null
  );

  readonly selectedReplies = computed(() => {
    const c = this.selected();
    if (!c) return [];
    return this.store.repliesByParent().get(c.externalCommentId) ?? [];
  });

  ngOnInit(): void {
    this.store.loadComments();
  }

  select(id: number): void {
    this.selectedId.set(id);
    this.replyDraft.set('');
  }

  async send(): Promise<void> {
    const c = this.selected();
    const text = this.replyDraft().trim();
    if (!c || !text) return;
    await this.store.reply(c.id, text);
    this.replyDraft.set('');
  }
}

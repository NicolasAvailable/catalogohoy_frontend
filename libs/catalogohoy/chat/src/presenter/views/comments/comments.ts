import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { CommentsStore } from '../../../infrastructure/comments.store';

// Bandeja de comentarios de posts (Instagram + Facebook). Los comentarios NO son
// conversaciones 1:1 → van en su propia sección, agrupados por comentario del
// cliente con nuestras respuestas anidadas.
@Component({
  selector: 'lib-comments',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslocoPipe],
  host: { class: 'flex-1 flex flex-col min-h-0 -m-4' },
  template: `
    <div class="flex-1 flex flex-col min-h-0 bg-lino-400">
      <header class="shrink-0 bg-white border-b border-grey-50 px-5 py-4 flex items-center gap-3">
        <h1 class="text-xl font-bold text-grey-800">{{ 'Comentarios' | transloco }}</h1>
        @if (store.openCount() > 0) {
          <span class="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
            {{ store.openCount() }} {{ 'sin responder' | transloco }}
          </span>
        }
      </header>

      <div class="flex-1 overflow-y-auto px-4 py-4">
        @if (store.isLoading() && !store.comments().length) {
          <div class="flex flex-col gap-3 max-w-2xl mx-auto animate-pulse">
            @for (_ of [1, 2, 3, 4]; track $index) {
              <div class="bg-white rounded-xl border border-grey-50 p-4 flex flex-col gap-2">
                <div class="h-3.5 w-40 bg-grey-50 rounded"></div>
                <div class="h-3 w-full bg-grey-50 rounded"></div>
                <div class="h-9 w-full bg-grey-50 rounded-lg mt-2"></div>
              </div>
            }
          </div>
        } @else if (!store.threads().length) {
          <div class="flex flex-col items-center justify-center gap-4 h-full text-center py-16">
            <span class="text-5xl">💬</span>
            <h2 class="text-xl font-bold text-grey-700">
              {{ 'Todavía no hay comentarios' | transloco }}
            </h2>
            <p class="text-grey-400 max-w-md leading-relaxed">
              {{ 'Los comentarios de tus posts de Instagram y Facebook van a aparecer acá para que los respondas.' | transloco }}
            </p>
            <a
              routerLink="/admin/chat/connect"
              class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-500 text-white text-base font-semibold hover:bg-primary-600 transition-colors"
            >
              {{ 'Conectar canales' | transloco }}
              <ui-icon name="arrow-right" size="18" />
            </a>
          </div>
        } @else {
          <div class="flex flex-col gap-3 max-w-2xl mx-auto">
            @for (c of store.threads(); track c.id) {
              <article class="bg-white rounded-xl border border-grey-50 p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span
                    class="px-1.5 py-0.5 rounded text-[0.65rem] font-bold text-white"
                    [class.bg-pink-500]="c.channel === 'instagram'"
                    [class.bg-blue-600]="c.channel === 'facebook'"
                  >
                    {{ c.channel === 'instagram' ? 'IG' : 'FB' }}
                  </span>
                  <span class="font-semibold text-grey-800 text-sm">
                    {{ c.authorName || c.authorUsername || ('Alguien' | transloco) }}
                  </span>
                  @if (c.postPermalink) {
                    <a
                      [href]="c.postPermalink"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ml-auto text-xs text-primary-600 hover:underline"
                    >
                      {{ 'Ver post' | transloco }} ↗
                    </a>
                  }
                </div>

                <p class="text-grey-700 text-sm whitespace-pre-wrap">{{ c.text }}</p>

                @for (r of store.repliesByParent().get(c.externalCommentId) ?? []; track r.id) {
                  <div class="mt-2 ml-4 pl-3 border-l-2 border-primary-100">
                    <p class="text-[0.7rem] text-grey-400 mb-0.5">{{ 'Tu respuesta' | transloco }}</p>
                    <p class="text-grey-600 text-sm whitespace-pre-wrap">{{ r.text }}</p>
                  </div>
                }

                @if (c.status !== 'replied') {
                  <div class="mt-3 flex items-end gap-2">
                    <textarea
                      rows="1"
                      [value]="drafts()[c.id] ?? ''"
                      (input)="setDraft(c.id, $event)"
                      [placeholder]="'Responder…' | transloco"
                      class="flex-1 resize-none rounded-lg border border-grey-100 px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                    ></textarea>
                    <button
                      type="button"
                      (click)="reply(c.id)"
                      [disabled]="store.replyingId() === c.id || !(drafts()[c.id] ?? '').trim()"
                      class="shrink-0 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50"
                    >
                      {{ (store.replyingId() === c.id ? 'Enviando…' : 'Responder') | transloco }}
                    </button>
                  </div>
                } @else {
                  <p class="mt-2 text-xs text-green-600">✓ {{ 'Respondido' | transloco }}</p>
                }
              </article>
            }
          </div>
        }

        @if (store.error()) {
          <p class="text-center text-red-500 text-sm mt-3">{{ store.error() }}</p>
        }
      </div>
    </div>
  `,
})
export class CommentsComponent implements OnInit {
  readonly store = inject(CommentsStore);
  readonly drafts = signal<Record<number, string | undefined>>({});

  ngOnInit(): void {
    this.store.loadComments();
  }

  setDraft(id: number, ev: Event): void {
    const value = (ev.target as HTMLTextAreaElement).value;
    this.drafts.update((d) => ({ ...d, [id]: value }));
  }

  async reply(id: number): Promise<void> {
    const text = (this.drafts()[id] ?? '').trim();
    if (!text) return;
    await this.store.reply(id, text);
    this.drafts.update((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }
}

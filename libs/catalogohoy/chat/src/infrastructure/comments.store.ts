import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { SocialComment } from '../domain';
import { CommentsService } from './comments.service';

type CommentsState = {
  comments: SocialComment[];
  isLoading: boolean;
  /** Id del comentario que se está respondiendo (spinner del botón). */
  replyingId: number | null;
  error: string | null;
};

const initialState: CommentsState = {
  comments: [],
  isLoading: false,
  replyingId: null,
  error: null,
};

export const CommentsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ comments }) => ({
    /** Comentarios de clientes (no nuestras respuestas), más recientes primero. */
    threads: computed(() => comments().filter((c) => !c.isMine)),
    /** Cuántos comentarios de clientes están sin responder (badge). */
    openCount: computed(
      () => comments().filter((c) => !c.isMine && c.status === 'open').length
    ),
    /** Nuestras respuestas indexadas por el comentario padre. */
    repliesByParent: computed(() => {
      const map = new Map<string, SocialComment[]>();
      for (const c of comments()) {
        if (!c.parentCommentId) continue;
        const arr = map.get(c.parentCommentId) ?? [];
        arr.push(c);
        map.set(c.parentCommentId, arr);
      }
      return map;
    }),
  })),
  withMethods(
    (
      store,
      service = inject(CommentsService),
      tenantStore = inject(TenantStore)
    ) => {
      const load = async (): Promise<void> => {
        patchState(store, { isLoading: true, error: null });
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isLoading: false });
          return;
        }
        const res = await service.getComments(tenantId);
        res
          .mapRight((comments) => patchState(store, { comments, isLoading: false }))
          .mapLeft((e) => patchState(store, { error: e.message, isLoading: false }));
      };

      return {
        loadComments: load,
        async reply(commentId: number, text: string): Promise<void> {
          const clean = text.trim();
          if (!clean) return;
          patchState(store, { replyingId: commentId, error: null });
          const res = await service.reply(commentId, clean);
          patchState(store, { replyingId: null });
          let ok = false;
          res
            .mapRight(() => {
              ok = true;
            })
            .mapLeft((e) => patchState(store, { error: e.message }));
          if (ok) await load();
        },
      };
    }
  )
);

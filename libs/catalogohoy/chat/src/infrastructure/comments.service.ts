import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { SocialComment, SocialCommentMapper } from '../domain';

/** Comentarios de posts (Instagram + Facebook) del CRM omnicanal. */
@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Todos los comentarios del tenant, más recientes primero. */
  async getComments(
    tenantId: number
  ): Promise<E.Either<Error, SocialComment[]>> {
    const { data, error } = await this.client
      .from('social_comments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(SocialCommentMapper.toDomainList(data ?? []));
  }

  /** Responde públicamente el comentario (edge function social-comment-reply). */
  async reply(
    commentId: number,
    text: string
  ): Promise<E.Either<Error, string>> {
    const { data, error } = await this.client.functions.invoke(
      'social-comment-reply',
      { body: { commentId, text } }
    );

    if (error) {
      const msg =
        (data as { error?: string } | null)?.error ??
        error.message ??
        'No se pudo publicar la respuesta';
      return E.left(new Error(msg));
    }
    if (!data?.success) {
      return E.left(new Error(data?.error ?? 'No se pudo publicar la respuesta'));
    }
    return E.right(String(data.replyId));
  }
}

/** Canal del comentario de post (bandeja omnicanal de comentarios). */
export type SocialCommentChannel = 'instagram' | 'facebook';

/** Un comentario de un post de IG o FB (many-to-one contra un post). */
export interface SocialComment {
  id: number;
  tenantId: number;
  channel: SocialCommentChannel;
  /** Id del comentario en Meta. */
  externalCommentId: string;
  /** Id del comentario padre si es una respuesta a otro comentario. */
  parentCommentId: string | null;
  /** Media id (IG) / post_id (FB) del post comentado. */
  postId: string | null;
  postPermalink: string | null;
  /** Caption/texto del post (para anclarlo arriba como "mensaje original"). */
  postCaption: string | null;
  /** Miniatura del post. */
  postThumbnailUrl: string | null;
  authorId: string | null;
  authorName: string | null;
  authorUsername: string | null;
  text: string | null;
  mediaUrl: string | null;
  /** true si es una respuesta nuestra (del negocio). */
  isMine: boolean;
  status: 'open' | 'replied' | 'hidden';
  createdAt: string;
}

/** Fila cruda de la tabla social_comments (snake_case). */
interface SocialCommentRow {
  id: number;
  tenant_id: number;
  channel: string | null;
  external_comment_id: string;
  parent_comment_id: string | null;
  post_id: string | null;
  post_permalink: string | null;
  post_caption: string | null;
  post_thumbnail_url: string | null;
  author_id: string | null;
  author_name: string | null;
  author_username: string | null;
  text: string | null;
  media_url: string | null;
  is_mine: boolean | null;
  status: string | null;
  created_at: string;
}

export class SocialCommentMapper {
  static toDomain(row: SocialCommentRow): SocialComment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      channel: (row.channel ?? 'instagram') as SocialCommentChannel,
      externalCommentId: row.external_comment_id,
      parentCommentId: row.parent_comment_id ?? null,
      postId: row.post_id ?? null,
      postPermalink: row.post_permalink ?? null,
      postCaption: row.post_caption ?? null,
      postThumbnailUrl: row.post_thumbnail_url ?? null,
      authorId: row.author_id ?? null,
      authorName: row.author_name ?? null,
      authorUsername: row.author_username ?? null,
      text: row.text ?? null,
      mediaUrl: row.media_url ?? null,
      isMine: row.is_mine ?? false,
      status: (row.status ?? 'open') as SocialComment['status'],
      createdAt: row.created_at,
    };
  }

  static toDomainList(rows: SocialCommentRow[]): SocialComment[] {
    return (rows ?? []).map((r) => SocialCommentMapper.toDomain(r));
  }
}

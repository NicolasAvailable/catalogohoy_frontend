import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import {
  NewsletterIssue,
  NewsletterList,
  NewsletterSendResult,
  NewsletterStatus,
} from './newsletter.model';

/** Newsletter de novedades (CAT-97). RPCs y edge gated a admin interno. */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(): Promise<Either<Error, NewsletterList>> {
    const { data, error } = await this.client.rpc('newsletter_admin_list');
    if (error) return E.left(new Error(error.message));
    return E.right(data as NewsletterList);
  }

  async save(issue: NewsletterIssue): Promise<Either<Error, number>> {
    const { data, error } = await this.client.rpc('newsletter_admin_save', {
      p: {
        id: issue.id,
        kind: issue.kind,
        period_start: issue.period_start,
        period_end: issue.period_end,
        subject: issue.subject,
        title: issue.title,
        intro: issue.intro,
        sections: issue.sections,
        outro: issue.outro,
      },
    });
    if (error) return E.left(new Error(error.message));
    return E.right(data as number);
  }

  async setStatus(
    id: number,
    status: NewsletterStatus
  ): Promise<Either<Error, void>> {
    const { error } = await this.client.rpc('newsletter_admin_set_status', {
      p_id: id,
      p_status: status,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  preview(id: number) {
    return this.invoke<{ subject: string; html: string }>({ action: 'preview', id });
  }

  test(id: number, email?: string) {
    return this.invoke<{ ok: boolean; to: string }>({ action: 'test', id, email });
  }

  audience(id: number) {
    return this.invoke<{ remaining: number }>({ action: 'audience', id });
  }

  send(id: number, limit = 150) {
    return this.invoke<NewsletterSendResult>({ action: 'send', id, limit });
  }

  private async invoke<T>(body: Record<string, unknown>): Promise<Either<Error, T>> {
    const { data, error } = await this.client.functions.invoke<T>(
      'send-newsletter',
      { body }
    );
    if (error) {
      // FunctionsHttpError trae el JSON con el motivo en context.
      const ctx = (error as { context?: Response }).context;
      const detail = ctx ? await ctx.json().catch(() => null) : null;
      return E.left(new Error(detail?.error ?? error.message));
    }
    const payload = data as T & { error?: string };
    if (payload?.error) return E.left(new Error(payload.error));
    return E.right(payload);
  }
}

import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { SesEmailRow, SesStats } from './email-ses.model';

@Injectable({ providedIn: 'root' })
export class EmailSesService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Métricas de envío de Amazon SES (gated a admin interno en la edge function). */
  async stats(): Promise<Either<Error, SesStats>> {
    const { data, error } = await this.client.functions.invoke<SesStats>(
      'ses-stats'
    );
    if (error) return E.left(new Error(error.message));
    const payload = data as SesStats & { error?: string };
    if (payload?.error) return E.left(new Error(payload.error));
    return E.right(payload);
  }

  /** Log por-correo (a quién se envió, estado, asunto). Gated en la RPC. */
  async emails(
    opts: { search?: string | null; status?: string | null; limit?: number } = {}
  ): Promise<Either<Error, SesEmailRow[]>> {
    const { data, error } = await this.client.rpc('list_ses_emails_admin', {
      p_search: opts.search?.trim() || null,
      p_status: opts.status ?? null,
      p_limit: opts.limit ?? 100,
      p_offset: 0,
    });
    if (error) return E.left(new Error(error.message));
    return E.right((data ?? []) as SesEmailRow[]);
  }
}

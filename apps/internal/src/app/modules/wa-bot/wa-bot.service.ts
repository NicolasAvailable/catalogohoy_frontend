import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';

export interface WaBotDay { day: string; messages: number; credits: number; cost_usd: number }
export interface WaBotTenantRow { tenant_id: number; tenant_name: string | null; messages: number; credits: number; cost_usd: number; last_at: string }
export interface WaBotLinkRow {
  id: number; tenant_id: number; tenant_name: string | null; phone: string;
  user_name: string | null; user_email: string | null; created_at: string; last_used_at: string | null;
}
export interface WaBotAdminStats {
  links: WaBotLinkRow[];
  today: { messages: number; credits: number; cost_usd: number };
  last_30d: WaBotDay[];
  by_tenant: WaBotTenantRow[];
  errors_7d: number;
}

export interface WaBotToolTrace { name: string; input: unknown; output: string; error: boolean; ms: number }
export interface WaBotDebug {
  model?: string;
  ms?: number;
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; tools: number };
  cost_usd?: number;
  balance_after?: number;
  tools?: WaBotToolTrace[];
  error?: string;
  stack?: string;
}
export interface WaBotMedia { url: string; type: 'image' | 'audio' | 'video' | 'document'; name?: string }
export interface WaBotLogRow {
  id: number; tenant_id: number; phone: string; role: 'user' | 'assistant' | 'system';
  body: string; media: WaBotMedia[]; actions: { tool: string; label: string; url?: string }[];
  credits: number; created_at: string; debug: WaBotDebug | null;
}

/** Panel interno del asistente de WhatsApp (CAT-78): RPCs SECURITY DEFINER
 *  gateadas por email (`wa_bot_admin_stats`, `wa_bot_admin_messages`). */
@Injectable({ providedIn: 'root' })
export class WaBotAdminService {
  private readonly client = SupabaseClientProvider.getInstance();

  async stats(): Promise<Either<Error, WaBotAdminStats>> {
    const { data, error } = await this.client.rpc('wa_bot_admin_stats');
    if (error) return E.left(new Error(error.message));
    return E.right(data as WaBotAdminStats);
  }

  /** Registro (más reciente primero en la BD; se devuelve en orden cronológico). */
  async messages(q: { tenantId?: number | null; phone?: string | null; before?: number | null; limit?: number }): Promise<Either<Error, WaBotLogRow[]>> {
    const { data, error } = await this.client.rpc('wa_bot_admin_messages', {
      p_tenant_id: q.tenantId ?? null,
      p_phone: q.phone ?? null,
      p_before: q.before ?? null,
      p_limit: q.limit ?? 100,
    });
    if (error) return E.left(new Error(error.message));
    // Los registros viejos guardan solo la URL de la foto; los nuevos, el objeto.
    const rows = ((data ?? []) as (Omit<WaBotLogRow, 'media'> & { media: (string | WaBotMedia)[] })[]).map((m) => ({
      ...m,
      media: (m.media ?? []).map((x) => (typeof x === 'string' ? { url: x, type: 'image' as const } : x)),
    }));
    return E.right(rows.reverse());
  }
}

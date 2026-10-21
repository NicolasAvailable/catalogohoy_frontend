import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';

export interface WaBotLink {
  id: number;
  phone: string;
  created_at: string;
  last_used_at: string | null;
}

export interface WaBotStatus {
  botPhone: string;
  links: WaBotLink[];
  /** Máximo de números conectados por tienda. */
  maxLinks?: number;
}

export interface WaBotCode {
  code: string;
  botPhone: string;
  waLink: string;
  expiresInMinutes: number;
}

export { WA_BOT_BETA_TENANTS } from '@catalogohoy/core';

/** Adjunto del chat: foto, audio, video o documento que se mandó por WhatsApp. */
export interface WaBotMedia {
  url: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name?: string;
}

/** Los registros viejos guardan solo la URL de la foto; los nuevos, el objeto. */
const toMedia = (m: string | WaBotMedia): WaBotMedia => (typeof m === 'string' ? { url: m, type: 'image' } : m);

export interface WaBotAction {
  tool: string;
  label: string;
  url?: string;
}

/** Un mensaje del registro: lo que escribió el dueño, lo que respondió el
 *  asistente (con sus acciones y créditos) o un evento del sistema. */
export interface WaBotMessage {
  id: number;
  phone: string;
  role: 'user' | 'assistant' | 'system';
  body: string;
  media: WaBotMedia[];
  actions: WaBotAction[];
  credits: number;
  created_at: string;
}

export interface WaBotStats {
  messagesToday: number;
  creditsToday: number;
  messages30d: number;
  credits30d: number;
  balance: number;
  monthlyAllowance: number;
  creditCost: number;
}

export interface WaBotActivity {
  messages: WaBotMessage[];
  hasMore: boolean;
  stats: WaBotStats;
}

/** Bot de WhatsApp para gestionar la tienda (CAT-78): vínculo del número del
 *  dueño vía la edge `wa-store-bot`. */
@Injectable({ providedIn: 'root' })
export class WaBotService {
  private readonly client = SupabaseClientProvider.getInstance();

  public getStatus(tenantId: number): Promise<E.Either<Error, WaBotStatus>> {
    return this.call<WaBotStatus>({ action: 'status', tenantId });
  }

  public createCode(tenantId: number): Promise<E.Either<Error, WaBotCode>> {
    return this.call<WaBotCode>({ action: 'create_code', tenantId });
  }

  public unlink(tenantId: number, linkId: number): Promise<E.Either<Error, { ok: boolean }>> {
    return this.call<{ ok: boolean }>({ action: 'unlink', tenantId, linkId });
  }

  /** Registro de conversaciones (más recientes; `before` pagina hacia atrás). */
  public async getActivity(
    tenantId: number,
    opts: { phone?: string | null; before?: number | null; limit?: number } = {}
  ): Promise<E.Either<Error, WaBotActivity>> {
    const result = await this.call<WaBotActivity>({ action: 'activity', tenantId, ...opts });
    return result.mapRight((a) => ({
      ...a,
      messages: a.messages.map((m) => ({ ...m, media: (m.media ?? []).map(toMedia) })),
    }));
  }

  private async call<T>(body: Record<string, unknown>): Promise<E.Either<Error, T>> {
    const { data, error } = await this.client.functions.invoke<T>('wa-store-bot', { body });
    if (error) return E.left(new Error(error.message));
    if (!data) return E.left(new Error('No se recibió respuesta del servidor'));
    return E.right(data);
  }
}

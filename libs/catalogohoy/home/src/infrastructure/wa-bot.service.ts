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

  private async call<T>(body: Record<string, unknown>): Promise<E.Either<Error, T>> {
    const { data, error } = await this.client.functions.invoke<T>('wa-store-bot', { body });
    if (error) return E.left(new Error(error.message));
    if (!data) return E.left(new Error('No se recibió respuesta del servidor'));
    return E.right(data);
  }
}

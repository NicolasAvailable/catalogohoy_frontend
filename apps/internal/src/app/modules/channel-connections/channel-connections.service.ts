import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { ChannelConnection, ChannelType } from './channel-connections.model';

interface ChannelConnectionRow {
  channel: ChannelType;
  tenant_id: number | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  identity: string | null;
  display_name: string | null;
  connected_at: string;
}

@Injectable({ providedIn: 'root' })
export class ChannelConnectionsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /**
   * Lista las cuentas de canales conectadas (WhatsApp Business + redes
   * sociales). Fuente: `whatsapp_accounts` (status='active') unido con
   * `social_accounts` (Instagram / TikTok, status='active'). El RPC
   * `channel_connections_admin` aplica la autorización server-side.
   */
  async list(): Promise<Either<Error, ChannelConnection[]>> {
    const { data, error } = await this.client.rpc('channel_connections_admin');

    if (error) {
      return E.left(new Error(error.message));
    }

    const connections: ChannelConnection[] = (
      (data as ChannelConnectionRow[]) ?? []
    ).map((row) => ({
      channel: row.channel,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      identity: row.identity,
      displayName: row.display_name,
      connectedAt: row.connected_at,
    }));

    return E.right(connections);
  }
}

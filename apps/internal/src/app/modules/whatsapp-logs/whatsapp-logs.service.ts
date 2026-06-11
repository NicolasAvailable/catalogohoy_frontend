import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { WhatsappLog, WhatsappLogStatus } from './whatsapp-logs.model';

interface WhatsappLogRow {
  id: number;
  tenant_id: number | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  template_type: string;
  recipient: string | null;
  status: WhatsappLogStatus;
  message_id: string | null;
  error: string | null;
  url_button_param: string | null;
  created_at: string;
}

export interface WhatsappLogsQuery {
  status?: WhatsappLogStatus | null;
  templateType?: string | null;
  search?: string | null;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class WhatsappLogsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /**
   * Lee el historial de notificaciones WhatsApp enviadas por la plataforma.
   * La fuente es `whatsapp_notification_logs`, que la edge function
   * `send-whatsapp-notification` escribe en cada intento de envío. El RPC
   * `list_whatsapp_logs_admin` aplica la autorización server-side.
   */
  async list(
    query: WhatsappLogsQuery = {}
  ): Promise<Either<Error, WhatsappLog[]>> {
    const { data, error } = await this.client.rpc('list_whatsapp_logs_admin', {
      p_limit: query.limit ?? 500,
      p_status: query.status ?? null,
      p_template_type: query.templateType ?? null,
      p_search: query.search?.trim() || null,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    const logs: WhatsappLog[] = ((data as WhatsappLogRow[]) ?? []).map(
      (row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        templateType: row.template_type,
        recipient: row.recipient,
        status: row.status,
        messageId: row.message_id,
        error: row.error,
        urlButtonParam: row.url_button_param,
        createdAt: row.created_at,
      })
    );

    return E.right(logs);
  }
}

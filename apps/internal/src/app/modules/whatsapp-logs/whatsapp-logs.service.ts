import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import {
  WhatsappLog,
  WhatsappLogStatus,
  WhatsappMonthlyRow,
  WhatsappStats,
} from './whatsapp-logs.model';

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
  variables: string[] | null;
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
        variables: row.variables,
        urlButtonParam: row.url_button_param,
        createdAt: row.created_at,
      })
    );

    return E.right(logs);
  }

  /**
   * Costo real facturado por Meta (pricing_analytics de la WABA de
   * plataforma), por mes y categoría. Gated a admin interno en la edge
   * function `whatsapp-stats`.
   */
  async stats(): Promise<Either<Error, WhatsappStats>> {
    const { data, error } = await this.client.functions.invoke<WhatsappStats>(
      'whatsapp-stats'
    );
    if (error) return E.left(new Error(error.message));
    const payload = data as WhatsappStats & { error?: string };
    if (payload?.error) return E.left(new Error(payload.error));
    return E.right(payload);
  }

  /** Agregado mensual de envíos por plantilla. Gated en la RPC. */
  async monthly(
    months = 3
  ): Promise<Either<Error, WhatsappMonthlyRow[]>> {
    const { data, error } = await this.client.rpc(
      'whatsapp_notification_stats_admin',
      { p_months: months }
    );
    if (error) return E.left(new Error(error.message));
    type Row = {
      month: string;
      template_type: string;
      sent: number;
      failed: number;
      skipped: number;
    };
    const rows: WhatsappMonthlyRow[] = ((data as Row[]) ?? []).map((r) => ({
      month: r.month,
      templateType: r.template_type,
      sent: Number(r.sent) || 0,
      failed: Number(r.failed) || 0,
      skipped: Number(r.skipped) || 0,
    }));
    return E.right(rows);
  }
}

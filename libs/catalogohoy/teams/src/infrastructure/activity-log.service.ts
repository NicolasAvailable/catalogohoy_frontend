import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  ActivityLogEntry,
  ActivityLogPage,
  FieldChange,
} from '../domain';

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Fire-and-forget. Logs an activity entry via the SECURITY DEFINER RPC.
   *  If the user is the owner the RPC silently no-ops; callers don't
   *  need to check ownership before calling. */
  async log(params: {
    action: string;
    entityType: string;
    entityId?: number | null;
    entityName?: string | null;
    changes?: FieldChange[];
  }): Promise<void> {
    try {
      await this.client.rpc('log_activity', {
        p_action: params.action,
        p_entity_type: params.entityType,
        p_entity_id: params.entityId ?? null,
        p_entity_name: params.entityName ?? null,
        p_changes: JSON.stringify(params.changes ?? []),
      });
    } catch {
      // Fire-and-forget — never block the caller's main operation.
    }
  }

  /** Build a changes array by diffing two snapshots. Only includes fields
   *  whose value actually changed. */
  diff<T extends Record<string, unknown>>(
    before: T,
    after: Partial<T>,
    fields?: string[]
  ): FieldChange[] {
    const keys = fields ?? Object.keys(after);
    const changes: FieldChange[] = [];
    for (const key of keys) {
      const from = before[key];
      const to = (after as Record<string, unknown>)[key];
      if (to !== undefined && JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field: key, from, to });
      }
    }
    return changes;
  }

  async getPage(
    tenantId: number,
    page = 1,
    pageSize = 20
  ): Promise<E.Either<Error, ActivityLogPage>> {
    const { data, error } = await this.client.rpc('get_activity_log', {
      p_tenant_id: tenantId,
      p_page: page,
      p_page_size: pageSize,
    });

    if (error) return E.left(new Error(error.message));

    const rows = (data ?? []) as Array<{
      id: number;
      user_email: string;
      user_name: string | null;
      action: string;
      entity_type: string;
      entity_id: number | null;
      entity_name: string | null;
      changes: FieldChange[] | string;
      created_at: string;
      total_count: number;
    }>;

    const entries: ActivityLogEntry[] = rows.map((row) => ({
      id: row.id,
      userEmail: row.user_email,
      userName: row.user_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name,
      changes: typeof row.changes === 'string'
        ? JSON.parse(row.changes)
        : row.changes ?? [],
      createdAt: row.created_at,
    }));

    return E.right({
      entries,
      totalCount: rows[0]?.total_count ?? 0,
    });
  }
}

import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { AiUsageLog, AiUsageStats } from './ai-usage.model';

interface StatsRow {
  total_credits: number;
  total_generations: number;
  users_count: number;
  by_feature: {
    feature: string;
    generations: number;
    credits: number;
  }[] | null;
  top_users: {
    user_id: number | null;
    user_name: string | null;
    user_email: string | null;
    generations: number;
    credits: number;
  }[] | null;
  last_30d: { day: string; credits: number; generations: number }[] | null;
}

interface LogRow {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  feature: string;
  prompt: string | null;
  credits: number;
  created_at: string;
}

export interface AiUsageLogsQuery {
  feature?: string | null;
  search?: string | null;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class AiUsageService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Métricas agregadas (total consumido, por feature, top usuarios). */
  async stats(): Promise<Either<Error, AiUsageStats>> {
    const { data, error } = await this.client.rpc('ai_usage_stats_admin');
    if (error) return E.left(new Error(error.message));

    const row = (data ?? {}) as StatsRow;
    return E.right({
      totalCredits: row.total_credits ?? 0,
      totalGenerations: row.total_generations ?? 0,
      usersCount: row.users_count ?? 0,
      byFeature: (row.by_feature ?? []).map((f) => ({
        feature: f.feature,
        generations: f.generations,
        credits: f.credits,
      })),
      topUsers: (row.top_users ?? []).map((u) => ({
        userId: u.user_id,
        userName: u.user_name,
        userEmail: u.user_email,
        generations: u.generations,
        credits: u.credits,
      })),
      last30d: (row.last_30d ?? []).map((d) => ({
        day: d.day,
        credits: d.credits,
        generations: d.generations,
      })),
    });
  }

  /** Log paginado de generaciones (usuario · feature · prompt · créditos). */
  async listLogs(
    query: AiUsageLogsQuery = {}
  ): Promise<Either<Error, AiUsageLog[]>> {
    const { data, error } = await this.client.rpc('list_ai_usage_logs_admin', {
      p_limit: query.limit ?? 300,
      p_feature: query.feature ?? null,
      p_search: query.search?.trim() || null,
    });
    if (error) return E.left(new Error(error.message));

    const logs: AiUsageLog[] = ((data as LogRow[]) ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      feature: row.feature,
      prompt: row.prompt,
      credits: row.credits,
      createdAt: row.created_at,
    }));
    return E.right(logs);
  }
}

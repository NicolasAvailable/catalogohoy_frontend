import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  BaseReportService,
  CreateReportInput,
  CreateReportTemplateInput,
  MetricsConfig,
  normalizeMetricsConfig,
  PublicReport,
  Report,
  ReportSnapshot,
  ReportTemplate,
  TemplatePeriodPreset,
} from '../domain';

type ReportRow = {
  id: number;
  tenant_id: number;
  public_token: string;
  title: string;
  period_start: string;
  period_end: string;
  metrics_config: MetricsConfig | Record<string, unknown>;
  snapshot: ReportSnapshot;
  template_id: number | null;
  created_at: string;
};

type ReportTemplateRow = {
  id: number;
  tenant_id: number;
  title: string;
  period_preset: TemplatePeriodPreset;
  metrics_config: Partial<MetricsConfig>;
  created_at: string;
};

function rowToTemplate(row: ReportTemplateRow): ReportTemplate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    periodPreset: row.period_preset,
    metricsConfig: normalizeMetricsConfig(row.metrics_config),
    createdAt: row.created_at,
  };
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    publicToken: row.public_token,
    title: row.title,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    metricsConfig: normalizeMetricsConfig(
      row.metrics_config as Partial<MetricsConfig>
    ),
    snapshot: row.snapshot,
    templateId: row.template_id ?? null,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class ReportService implements BaseReportService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async buildSnapshot(
    tenantId: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<E.Either<Error, ReportSnapshot>> {
    const { data, error } = await this.client.rpc('build_report_snapshot', {
      p_tenant_id: tenantId,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString(),
    });
    if (error) return E.left(new Error(error.message));
    return E.right(data as ReportSnapshot);
  }

  public async create(
    input: CreateReportInput
  ): Promise<E.Either<Error, Report>> {
    const snapshotResult = await this.buildSnapshot(
      input.tenantId,
      input.periodStart,
      input.periodEnd
    );
    if (snapshotResult.isLeft()) {
      return E.left(snapshotResult.value);
    }

    const { data, error } = await this.client
      .from('reports')
      .insert({
        tenant_id: input.tenantId,
        title: input.title,
        period_start: input.periodStart.toISOString(),
        period_end: input.periodEnd.toISOString(),
        metrics_config: input.metricsConfig,
        snapshot: snapshotResult.value,
        template_id: input.templateId ?? null,
      })
      .select('*')
      .single();

    if (error) return E.left(new Error(error.message));
    return E.right(rowToReport(data as ReportRow));
  }

  public async list(tenantId: number): Promise<E.Either<Error, Report[]>> {
    const { data, error } = await this.client
      .from('reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) return E.left(new Error(error.message));
    return E.right((data as ReportRow[]).map(rowToReport));
  }

  public async countGeneratedThisMonth(
    tenantId: number
  ): Promise<E.Either<Error, number>> {
    const { data, error } = await this.client.rpc('count_reports_this_month', {
      p_tenant_id: tenantId,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(Number(data ?? 0));
  }

  public async getById(id: number): Promise<E.Either<Error, Report>> {
    const { data, error } = await this.client
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(rowToReport(data as ReportRow));
  }

  public async getPublicByToken(
    token: string
  ): Promise<E.Either<Error, PublicReport>> {
    const { data, error } = await this.client.rpc('get_public_report', {
      p_token: token,
    });
    if (error) return E.left(new Error(error.message));
    if (!data || (data as { error?: string }).error) {
      return E.left(new Error((data as { error?: string })?.error ?? 'not_found'));
    }
    const raw = data as PublicReport & { metricsConfig: Partial<MetricsConfig> };
    return E.right({
      ...raw,
      metricsConfig: normalizeMetricsConfig(raw.metricsConfig),
    });
  }

  /**
   * Soft-delete: marks the row as hidden but keeps it around so the monthly
   * plan quota stays honest — if a user generates 10 reports and "deletes"
   * them all, they've still used 10 of their allowance.
   */
  public async delete(id: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  public async listTemplates(
    tenantId: number
  ): Promise<E.Either<Error, ReportTemplate[]>> {
    const { data, error } = await this.client
      .from('report_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) return E.left(new Error(error.message));
    return E.right((data as ReportTemplateRow[]).map(rowToTemplate));
  }

  public async createTemplate(
    input: CreateReportTemplateInput
  ): Promise<E.Either<Error, ReportTemplate>> {
    const { data, error } = await this.client
      .from('report_templates')
      .insert({
        tenant_id: input.tenantId,
        title: input.title,
        period_preset: input.periodPreset,
        metrics_config: input.metricsConfig,
      })
      .select('*')
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(rowToTemplate(data as ReportTemplateRow));
  }

  /** Hard delete — reports generated from it stay (template_id → null). */
  public async deleteTemplate(id: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('report_templates')
      .delete()
      .eq('id', id);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }
}

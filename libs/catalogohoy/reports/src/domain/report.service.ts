import { E } from '@shared/domain';
import {
  MetricsConfig,
  PublicReport,
  Report,
  ReportSnapshot,
  ReportTemplate,
  TemplatePeriodPreset,
} from './report.model';

export interface CreateReportInput {
  tenantId: number;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  metricsConfig: MetricsConfig;
  /** Set when the report was generated from a saved template. */
  templateId?: number | null;
}

export interface CreateReportTemplateInput {
  tenantId: number;
  title: string;
  periodPreset: TemplatePeriodPreset;
  metricsConfig: MetricsConfig;
}

export abstract class BaseReportService {
  abstract buildSnapshot(
    tenantId: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<E.Either<Error, ReportSnapshot>>;

  abstract create(input: CreateReportInput): Promise<E.Either<Error, Report>>;

  abstract list(tenantId: number): Promise<E.Either<Error, Report[]>>;

  abstract getById(id: number): Promise<E.Either<Error, Report>>;

  abstract getPublicByToken(token: string): Promise<E.Either<Error, PublicReport>>;

  abstract delete(id: number): Promise<E.Either<Error, void>>;

  /**
   * How many reports this tenant has generated in the current calendar month,
   * including soft-deleted ones. Used to enforce the plan quota.
   */
  abstract countGeneratedThisMonth(
    tenantId: number
  ): Promise<E.Either<Error, number>>;

  abstract listTemplates(
    tenantId: number
  ): Promise<E.Either<Error, ReportTemplate[]>>;

  abstract createTemplate(
    input: CreateReportTemplateInput
  ): Promise<E.Either<Error, ReportTemplate>>;

  abstract deleteTemplate(id: number): Promise<E.Either<Error, void>>;
}

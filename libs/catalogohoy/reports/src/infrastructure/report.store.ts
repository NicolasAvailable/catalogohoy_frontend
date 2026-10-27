import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Report, ReportTemplate, resolvePresetRange } from '../domain';
import { ReportService } from './report.service';

type ReportState = {
  reports: Report[];
  /** Saved report setups the tenant can re-generate any time. */
  templates: ReportTemplate[];
  /**
   * Count of reports this tenant generated in the current calendar month —
   * INCLUDING soft-deleted ones. Source of truth for the plan quota.
   * Stays put even after deletions.
   */
  generationsThisMonth: number;
  isLoading: boolean;
  isGenerating: boolean;
};

const initialState: ReportState = {
  reports: [],
  templates: [],
  generationsThisMonth: 0,
  isLoading: false,
  isGenerating: false,
};

export const ReportStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, service = inject(ReportService)) => {
    const create = async (
      input: Parameters<ReportService['create']>[0]
    ): Promise<Report | null> => {
      patchState(store, { isGenerating: true });
      const result = await service.create(input);
      const report = result.isRight() ? result.value : null;
      if (report) {
        patchState(store, (state) => ({
          reports: [report, ...state.reports],
          generationsThisMonth: state.generationsThisMonth + 1,
          isGenerating: false,
        }));
      } else {
        patchState(store, { isGenerating: false });
      }
      return report;
    };

    return {
      async load(tenantId: number) {
        patchState(store, { isLoading: true });
        const [listResult, countResult, templatesResult] = await Promise.all([
          service.list(tenantId),
          service.countGeneratedThisMonth(tenantId),
          service.listTemplates(tenantId),
        ]);

        templatesResult.mapRight((templates) =>
          patchState(store, { templates })
        );

        listResult
          .mapRight((reports) =>
            patchState(store, { reports, isLoading: false })
          )
          .mapLeft(() => patchState(store, { isLoading: false }));

        countResult.mapRight((count) =>
          patchState(store, { generationsThisMonth: count })
        );
      },

      create,

      async createTemplate(
        input: Parameters<ReportService['createTemplate']>[0]
      ): Promise<ReportTemplate | null> {
        const result = await service.createTemplate(input);
        if (result.isLeft()) return null;
        const template = result.value;
        patchState(store, (state) => ({
          templates: [template, ...state.templates],
        }));
        return template;
      },

      async removeTemplate(id: number): Promise<boolean> {
        const result = await service.deleteTemplate(id);
        if (result.isLeft()) return false;
        patchState(store, (state) => ({
          templates: state.templates.filter((t) => t.id !== id),
          reports: state.reports.map((r) =>
            r.templateId === id ? { ...r, templateId: null } : r
          ),
        }));
        return true;
      },

      /**
       * Generates a fresh report from a template: same title and metrics, the
       * template's relative period resolved as of today. Counts toward the
       * monthly quota like any other report (via the `create` flow).
       */
      async generateFromTemplate(
        template: ReportTemplate,
        tenantId: number
      ): Promise<Report | null> {
        const { start, end } = resolvePresetRange(template.periodPreset);
        return create({
          tenantId,
          title: template.title,
          periodStart: start,
          periodEnd: end,
          metricsConfig: template.metricsConfig,
          templateId: template.id,
        });
      },

      /**
       * Soft-delete — drops the row from the visible list but leaves the
       * monthly generation counter untouched on purpose: the tenant already
       * "spent" that slot in their plan quota.
       */
      async remove(id: number): Promise<boolean> {
        const result = await service.delete(id);
        if (result.isRight()) {
          patchState(store, (state) => ({
            reports: state.reports.filter((r) => r.id !== id),
          }));
          return true;
        }
        return false;
      },

      setReports(reports: Report[]) {
        patchState(store, { reports });
      },
    };
  })
);

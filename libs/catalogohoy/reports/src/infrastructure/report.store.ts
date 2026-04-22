import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Report } from '../domain';
import { ReportService } from './report.service';

type ReportState = {
  reports: Report[];
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
  generationsThisMonth: 0,
  isLoading: false,
  isGenerating: false,
};

export const ReportStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, service = inject(ReportService)) => ({
    async load(tenantId: number) {
      patchState(store, { isLoading: true });
      const [listResult, countResult] = await Promise.all([
        service.list(tenantId),
        service.countGeneratedThisMonth(tenantId),
      ]);

      listResult
        .mapRight((reports) => patchState(store, { reports, isLoading: false }))
        .mapLeft(() => patchState(store, { isLoading: false }));

      countResult.mapRight((count) =>
        patchState(store, { generationsThisMonth: count })
      );
    },

    async create(
      input: Parameters<ReportService['create']>[0]
    ): Promise<Report | null> {
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
  }))
);

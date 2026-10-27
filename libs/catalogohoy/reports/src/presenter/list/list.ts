import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlanStore } from '@catalogohoy/plan';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  CardComponent,
  ConfirmDialogComponent,
  IconComponent,
  SkeletonListComponent,
} from '@ui';
import { presetLabel, Report, ReportTemplate } from '../../domain';
import { ReportStore } from '../../infrastructure';

/** Maximum reports a tenant can generate per calendar month, by plan id.
 *  Debe coincidir con lo prometido en PLAN_FEATURES (plan lib). */
const REPORTS_LIMIT_BY_PLAN: Record<string, number> = {
  gratis:     1,
  basico:     10,
  pro:        20,
  avanzado:   30,
  enterprise: 100,
};

@Component({
  selector: 'lib-report-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ButtonComponent,
    CardComponent,
    ConfirmDialogComponent,
    IconComponent,
    SkeletonListComponent,
    TranslocoPipe,
  ],
  templateUrl: './list.html',
  styleUrl: './list.css',
})
export default class ReportListComponent implements OnInit {
  public readonly store = inject(ReportStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly planStore = inject(PlanStore);
  private readonly permissions = inject(TeamPermissionsStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  public readonly canCreate = computed(
    () => this.permissions.isOwner() || this.permissions.can()('reportes', 'create')
  );
  public readonly canDelete = computed(
    () => this.permissions.isOwner() || this.permissions.can()('reportes', 'delete')
  );

  public readonly selectedReport = signal<Report | null>(null);
  public readonly selectedTemplate = signal<ReportTemplate | null>(null);
  /** Template whose history is being shown; null = all reports. */
  public readonly filterTemplateId = signal<number | null>(null);
  /** Template currently being generated (spinner on its button). */
  public readonly generatingTemplateId = signal<number | null>(null);

  public readonly presetLabel = presetLabel;

  public readonly visibleReports = computed(() => {
    const id = this.filterTemplateId();
    const reports = this.store.reports();
    return id == null ? reports : reports.filter((r) => r.templateId === id);
  });

  public readonly filterTemplate = computed(
    () => this.store.templates().find((t) => t.id === this.filterTemplateId()) ?? null
  );

  /** Per template: how many reports it generated and the latest one. */
  public readonly templateStats = computed(() => {
    const stats: Record<number, { count: number; last: Report | null }> = {};
    for (const r of this.store.reports()) {
      if (r.templateId == null) continue;
      const s = (stats[r.templateId] ??= { count: 0, last: null });
      s.count++;
      if (!s.last || r.createdAt > s.last.createdAt) s.last = r;
    }
    return stats;
  });

  @ViewChild('deleteReportDialog')
  public confirmDialog!: ConfirmDialogComponent;

  @ViewChild('deleteTemplateDialog')
  public templateDialog!: ConfirmDialogComponent;

  /** Reports this tenant has generated this month — kept in sync server-side
   *  via count_reports_this_month so it includes soft-deleted rows. */
  public readonly reportsThisMonth = computed(
    () => this.store.generationsThisMonth()
  );

  /** Max reports per month allowed by the current plan (fallback: gratis). */
  public readonly monthlyLimit = computed(() => {
    const planId = this.planStore.currentPlan()?.id ?? 'gratis';
    return REPORTS_LIMIT_BY_PLAN[planId] ?? REPORTS_LIMIT_BY_PLAN['gratis'];
  });

  public readonly limitReached = computed(
    () => this.reportsThisMonth() >= this.monthlyLimit()
  );

  async ngOnInit(): Promise<void> {
    this.planStore.loadTenantPlanUsage();
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) this.store.load(tenantId);
  }

  goToCreate(): void {
    if (!this.canCreate()) {
      this.toast.error(
        'No tienes permiso para generar reportes' as any
      );
      return;
    }
    if (this.limitReached()) {
      this.toast.error(
        'Alcanzaste el límite de reportes de tu plan este mes. Mejora tu plan para generar más.' as any
      );
      return;
    }
    this.router.navigate(['/admin/reports/new']);
  }

  goToDetail(report: Report): void {
    this.router.navigate(['/admin/reports', report.id]);
  }

  async copyPublicLink(event: Event, report: Report): Promise<void> {
    event.stopPropagation();
    const url = `${window.location.origin}/public/report/${report.publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Link copiado al portapapeles' as any);
    } catch {
      this.toast.error('No se pudo copiar el link' as any);
    }
  }

  onDelete(event: Event, report: Report): void {
    event.stopPropagation();
    if (!this.canDelete()) {
      this.toast.error('No tienes permiso para eliminar reportes' as any);
      return;
    }
    this.selectedReport.set(report);
    this.confirmDialog.warning();
  }

  async onConfirmDelete(): Promise<void> {
    const report = this.selectedReport();
    if (!report) return;
    const ok = await this.store.remove(report.id);
    if (ok) this.toast.success('Reporte eliminado' as any);
    this.selectedReport.set(null);
  }

  toggleTemplateFilter(template: ReportTemplate): void {
    this.filterTemplateId.set(
      this.filterTemplateId() === template.id ? null : template.id
    );
  }

  async generateFromTemplate(event: Event, template: ReportTemplate): Promise<void> {
    event.stopPropagation();
    if (!this.canCreate()) {
      this.toast.error('No tienes permiso para generar reportes' as any);
      return;
    }
    if (this.limitReached()) {
      this.toast.error(
        'Alcanzaste el límite de reportes de tu plan este mes. Mejora tu plan para generar más.' as any
      );
      return;
    }
    if (this.generatingTemplateId() != null) return;

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;

    this.generatingTemplateId.set(template.id);
    const report = await this.store.generateFromTemplate(template, tenantId);
    this.generatingTemplateId.set(null);

    if (!report) {
      this.toast.error('No se pudo generar el reporte' as any);
      return;
    }
    this.toast.success('Reporte generado con datos actualizados' as any);
    this.router.navigate(['/admin/reports', report.id]);
  }

  onDeleteTemplate(event: Event, template: ReportTemplate): void {
    event.stopPropagation();
    if (!this.canDelete()) {
      this.toast.error('No tienes permiso para eliminar plantillas' as any);
      return;
    }
    this.selectedTemplate.set(template);
    this.templateDialog.warning();
  }

  async onConfirmDeleteTemplate(): Promise<void> {
    const template = this.selectedTemplate();
    if (!template) return;
    const ok = await this.store.removeTemplate(template.id);
    if (ok) {
      this.toast.success('Plantilla eliminada' as any);
      if (this.filterTemplateId() === template.id) this.filterTemplateId.set(null);
    }
    this.selectedTemplate.set(null);
  }
}

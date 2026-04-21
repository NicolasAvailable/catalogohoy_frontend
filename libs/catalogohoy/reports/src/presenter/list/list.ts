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
import { PlanStore } from '@catalogohoy/plan';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  CardComponent,
  ConfirmDialogComponent,
  IconComponent,
  SkeletonListComponent,
} from '@ui';
import { Report } from '../../domain';
import { ReportStore } from '../../infrastructure';

/** Maximum reports a tenant can generate per calendar month, by plan id. */
const REPORTS_LIMIT_BY_PLAN: Record<string, number> = {
  gratis:   1,
  basico:   10,
  avanzado: 20,
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
  ],
  templateUrl: './list.html',
  styleUrl: './list.css',
})
export default class ReportListComponent implements OnInit {
  public readonly store = inject(ReportStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly planStore = inject(PlanStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  public readonly selectedReport = signal<Report | null>(null);

  @ViewChild(ConfirmDialogComponent)
  public confirmDialog!: ConfirmDialogComponent;

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
}

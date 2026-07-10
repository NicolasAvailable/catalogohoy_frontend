import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  CardComponent,
  DatepickerComponent,
  IconComponent,
  InputTextComponent,
  ToggleComponent,
} from '@ui';
import {
  DATE_RANGE_PRESETS,
  DateRangePreset,
  DEFAULT_METRICS_CONFIG,
  MetricsConfig,
} from '../../domain';
import { ReportStore } from '../../infrastructure';

@Component({
  selector: 'lib-report-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    CardComponent,
    DatepickerComponent,
    IconComponent,
    InputTextComponent,
    ToggleComponent,
    TranslocoPipe,
  ],
  templateUrl: './create.html',
  styleUrl: './create.css',
})
export default class ReportCreateComponent {
  public readonly store = inject(ReportStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  public readonly presets = DATE_RANGE_PRESETS;
  public readonly preset = signal<DateRangePreset>('last_30_days');

  public readonly title = signal<string>('Reporte del catálogo');
  public readonly metrics = signal<MetricsConfig>({ ...DEFAULT_METRICS_CONFIG });

  // Custom range — ui-datepicker emits Date objects, not strings.
  public readonly customStart = signal<Date | null>(null);
  public readonly customEnd   = signal<Date | null>(null);

  public readonly canSubmit = computed(() => {
    if (!this.title().trim()) return false;
    const keys = Object.keys(this.metrics()) as (keyof MetricsConfig)[];
    const anyMetric = keys.some((k) => this.metrics()[k]);
    if (!anyMetric) return false;
    if (this.preset() === 'custom') {
      const s = this.customStart();
      const e = this.customEnd();
      return !!s && !!e && s <= e;
    }
    return true;
  });

  toggleMetric(key: keyof MetricsConfig) {
    this.metrics.set({ ...this.metrics(), [key]: !this.metrics()[key] });
  }

  selectPreset(preset: DateRangePreset) {
    this.preset.set(preset);
  }

  cancel() {
    this.router.navigate(['/admin/reports']);
  }

  private resolveRange(): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (this.preset() === 'custom') {
      const start = new Date(this.customStart()!);
      start.setHours(0, 0, 0, 0);
      const customEnd = new Date(this.customEnd()!);
      customEnd.setHours(23, 59, 59, 999);
      return { start, end: customEnd };
    }

    const preset = this.presets.find((p) => p.key === this.preset());
    const days = preset?.days ?? 30;
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  async submit() {
    if (!this.canSubmit() || this.store.isGenerating()) return;

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.toast.error('No se pudo obtener información del negocio' as any);
      return;
    }

    const { start, end } = this.resolveRange();
    const report = await this.store.create({
      tenantId,
      title: this.title().trim(),
      periodStart: start,
      periodEnd: end,
      metricsConfig: this.metrics(),
    });

    if (!report) {
      this.toast.error('No se pudo generar el reporte' as any);
      return;
    }

    this.toast.success('Reporte generado' as any);
    this.router.navigate(['/admin/reports', report.id]);
  }
}

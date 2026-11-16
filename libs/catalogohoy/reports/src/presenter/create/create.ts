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
  METRIC_OPTIONS,
  MetricsConfig,
  resolvePresetRange,
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
  public readonly metricOptions = METRIC_OPTIONS;
  public readonly preset = signal<DateRangePreset>('last_30_days');

  public readonly title = signal<string>('Reporte del catálogo');
  public readonly metrics = signal<MetricsConfig>({ ...DEFAULT_METRICS_CONFIG });

  /** Also save the setup as a template to re-generate it every period. */
  public readonly saveAsTemplate = signal(false);
  /** A custom fixed range can't repeat, so templates need a relative preset. */
  public readonly canSaveTemplate = computed(() => this.preset() !== 'custom');

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
    if (preset === 'custom') this.saveAsTemplate.set(false);
  }

  cancel() {
    this.router.navigate(['/admin/reports']);
  }

  private resolveRange(): { start: Date; end: Date } {
    const preset = this.preset();
    if (preset === 'custom') {
      const start = new Date(this.customStart()!);
      start.setHours(0, 0, 0, 0);
      const customEnd = new Date(this.customEnd()!);
      customEnd.setHours(23, 59, 59, 999);
      return { start, end: customEnd };
    }
    return resolvePresetRange(preset);
  }

  async submit() {
    if (!this.canSubmit() || this.store.isGenerating()) return;

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.toast.error('No se pudo obtener información del negocio' as any);
      return;
    }

    const preset = this.preset();
    let templateId: number | null = null;
    if (this.saveAsTemplate() && preset !== 'custom') {
      const template = await this.store.createTemplate({
        tenantId,
        title: this.title().trim(),
        periodPreset: preset,
        metricsConfig: this.metrics(),
      });
      if (!template) {
        this.toast.error('No se pudo guardar la plantilla' as any);
        return;
      }
      templateId = template.id;
    }

    const { start, end } = this.resolveRange();
    const report = await this.store.create({
      tenantId,
      title: this.title().trim(),
      periodStart: start,
      periodEnd: end,
      metricsConfig: this.metrics(),
      templateId,
    });

    if (!report) {
      this.toast.error('No se pudo generar el reporte' as any);
      return;
    }

    this.toast.success('Reporte generado' as any);
    this.router.navigate(['/admin/reports', report.id]);
  }
}

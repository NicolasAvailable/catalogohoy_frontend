import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent, SkeletonListComponent } from '@ui';
import { EcommerceConfigStore } from '@catalogohoy/ecommerce-config';
import { Report } from '../../domain';
import { ReportService } from '../../infrastructure';
import { ReportContent } from '../components/report-content';

@Component({
  selector: 'lib-report-detail',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    IconComponent,
    ReportContent,
    SkeletonListComponent,
    TranslocoPipe,
  ],
  templateUrl: './detail.html',
  styleUrl: './detail.css',
})
export default class ReportDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ReportService);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly toast = inject(ToastService);

  public readonly report = signal<Report | null>(null);
  public readonly isLoading = signal(true);
  public readonly isExporting = signal(false);

  public readonly reportRef = viewChild<ElementRef<HTMLElement>>('reportRef');

  public readonly branding = computed(() => ({
    name: this.tenantStore.tenantName() ?? 'Catálogo',
    logo: this.configStore.config()?.logo ?? null,
    countryCode: this.tenantCurrency.countryCode(),
    currencyCode: this.tenantCurrency.localCode(),
    currencySymbol: this.tenantCurrency.localSymbol(),
  }));

  public readonly publicUrl = computed(() => {
    const r = this.report();
    if (!r) return '';
    return `${window.location.origin}/public/report/${r.publicToken}`;
  });

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;
    if (!id || Number.isNaN(id)) {
      this.router.navigate(['/admin/reports']);
      return;
    }

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) {
      this.tenantCurrency.load(tenantId);
      this.configStore.loadConfig(String(tenantId));
    }

    const result = await this.service.getById(id);
    result
      .mapRight((report) => this.report.set(report))
      .mapLeft(() => this.router.navigate(['/admin/reports']));
    this.isLoading.set(false);
  }

  goBack(): void {
    this.router.navigate(['/admin/reports']);
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl());
      this.toast.success('Link público copiado' as any);
    } catch {
      this.toast.error('No se pudo copiar el link' as any);
    }
  }

  openPublicLink(): void {
    window.open(this.publicUrl(), '_blank');
  }

  async downloadPdf(): Promise<void> {
    const el = this.reportRef()?.nativeElement;
    const r = this.report();
    if (!el || !r || this.isExporting()) return;

    this.isExporting.set(true);
    try {
      // Lazy-load the PDF deps — keeps them out of the main bundle.
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        // html2canvas rasterization at 2x occasionally clips glyphs when a
        // single-line element is exactly the text's cap height. Force a
        // relaxed line-height on every cloned element so captures keep all
        // ascenders/descenders visible. The real DOM is untouched.
        onclone: (doc) => {
          const style = doc.createElement('style');
          style.textContent = `
            * { line-height: 1.5 !important; }
            strong, h1, h2, h3, .customers__name, .customers__phone {
              padding-bottom: 3px !important;
            }
          `;
          doc.head.appendChild(style);
        },
      });
      const imgData = canvas.toDataURL('image/png');

      // A4 landscape gives us more horizontal room for wide charts/tables.
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth  = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth  = pageWidth - 10;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Paginate manually when the rendered image is taller than one page.
      let remaining = imgHeight;
      let position  = 5;
      let isFirst   = true;
      while (remaining > 0) {
        if (!isFirst) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
        remaining = remaining - (pageHeight - 10);
        position  = position - pageHeight + 10;
        isFirst = false;
      }

      pdf.save(`${r.title.replace(/[^\w-]+/g, '_')}.pdf`);
    } catch (err) {
      this.toast.error('No se pudo generar el PDF' as any);
      console.error(err);
    } finally {
      this.isExporting.set(false);
    }
  }
}

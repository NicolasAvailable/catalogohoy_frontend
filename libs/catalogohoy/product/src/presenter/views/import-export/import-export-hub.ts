import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { CategoryStore } from '@catalogohoy/category';
import { PlanStore } from '@catalogohoy/plan';
import {
  ButtonComponent,
  DialogComponent,
  IconComponent,
  ProgressBarComponent,
} from '@ui';
import { toast } from 'ngx-sonner';
import {
  ImportRowResult,
  ImportRowStatus,
  ImportSummary,
  ProductExcelRow,
} from '../../../domain';
import { ProductExcelService, ProductStore } from '../../../infrastructure';

type View =
  | 'hub'
  | 'export'
  | 'import-upload'
  | 'import-preview'
  | 'import-progress'
  | 'import-done';

@Component({
  selector: 'lib-import-export-hub',
  standalone: true,
  imports: [
    DialogComponent,
    ButtonComponent,
    IconComponent,
    ProgressBarComponent,
  ],
  templateUrl: './import-export-hub.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportExportHubComponent {
  private readonly productStore = inject(ProductStore);
  private readonly excelService = inject(ProductExcelService);
  private readonly categoryStore = inject(CategoryStore);
  private readonly planStore = inject(PlanStore);

  @ViewChild(DialogComponent) dialog!: DialogComponent;

  public readonly view = signal<View>('hub');
  public readonly isExporting = signal(false);
  public readonly parsedRows = signal<ProductExcelRow[]>([]);
  public readonly importResults = signal<ImportRowResult[]>([]);
  public readonly importSummary = signal<ImportSummary | null>(null);
  public readonly importProgress = signal(0);

  public open(): void {
    this.view.set('hub');
    this.parsedRows.set([]);
    this.importResults.set([]);
    this.importSummary.set(null);
    this.importProgress.set(0);
    this.dialog.show();
  }

  public async onExport(): Promise<void> {
    this.view.set('export');
    this.isExporting.set(true);

    await new Promise((r) => setTimeout(r, 300));

    const products = this.productStore.productList().products;
    if (products.length === 0) {
      toast.error('No hay productos para exportar');
      this.isExporting.set(false);
      this.view.set('hub');
      return;
    }

    const result = this.excelService.exportToExcel(products);
    result
      .mapRight(() => toast.success('Productos exportados correctamente'))
      .mapLeft((err) => toast.error(err.message));

    this.isExporting.set(false);
    setTimeout(() => this.dialog.hide(), 1200);
  }

  public onImport(): void {
    this.view.set('import-upload');
    this.categoryStore.categoryList$(1, 100);
  }

  public async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.processFile(file);
    input.value = '';
  }

  public async onFileDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    await this.processFile(file);
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  public async startImport(): Promise<void> {
    await this.planStore.refreshUsage();
    const remaining = this.planStore.remainingProducts();
    const rows = this.parsedRows();

    if (rows.length > remaining) {
      toast.error(
        `No puedes importar ${rows.length} productos. Tu plan solo permite ${remaining} más. Mejora tu plan para continuar.`
      );
      return;
    }

    this.view.set('import-progress');
    const results: ImportRowResult[] = rows.map((data, i) => ({
      rowIndex: i,
      data,
      status: 'pending' as ImportRowStatus,
    }));
    this.importResults.set([...results]);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      results[i] = { ...results[i], status: 'importing' };
      this.importResults.set([...results]);
      this.importProgress.set(Math.round((i / rows.length) * 100));

      const result = await this.excelService.importRow(rows[i]);
      result
        .mapRight(() => {
          results[i] = { ...results[i], status: 'success' };
          successCount++;
        })
        .mapLeft((err) => {
          results[i] = {
            ...results[i],
            status: 'error',
            errorMessage: err.message,
          };
          errorCount++;
        });
      this.importResults.set([...results]);
    }

    this.importProgress.set(100);
    this.importSummary.set({
      total: rows.length,
      success: successCount,
      errors: errorCount,
    });
    this.view.set('import-done');
    this.productStore.productList$();
  }

  public downloadTemplate(): void {
    this.excelService.downloadTemplate();
  }

  public close(): void {
    this.dialog.hide();
  }

  private async processFile(file: File): Promise<void> {
    const result = await this.excelService.parseExcelFile(file);
    result
      .mapRight((rows) => {
        this.parsedRows.set(rows);
        this.view.set('import-preview');
      })
      .mapLeft((err) => toast.error(err.message));
  }
}

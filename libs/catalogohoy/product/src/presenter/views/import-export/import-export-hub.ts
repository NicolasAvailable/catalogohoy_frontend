import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { CategoryStore } from '@catalogohoy/category';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
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
import { ProductAiExcelService, ProductExcelService, ProductStore } from '../../../infrastructure';

type View =
  | 'hub'
  | 'import-upload'
  | 'import-preview'
  | 'import-progress'
  | 'import-done'
  | 'ai-analyzing';

const AI_STATUS_MESSAGES = [
  { text: 'Analizando tu archivo...', icon: 'sparkles' },
  { text: 'Identificando columnas...', icon: 'search' },
  { text: 'Mapeando datos...', icon: 'arrow-up-down' },
  { text: 'Normalizando informacion...', icon: 'wand-sparkles' },
  { text: 'Preparando vista previa...', icon: 'eye' },
];

@Component({
  selector: 'lib-import-export-hub',
  standalone: true,
  imports: [
    DialogComponent,
    ButtonComponent,
    IconComponent,
    ProgressBarComponent,
    TranslocoPipe,
  ],
  templateUrl: './import-export-hub.html',
  styles: [`
    .indeterminate-bar {
      animation: indeterminate 1.5s ease-in-out infinite;
    }
    @keyframes indeterminate {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(100%); }
      100% { transform: translateX(200%); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportExportHubComponent {
  private readonly productStore = inject(ProductStore);
  private readonly excelService = inject(ProductExcelService);
  private readonly aiExcelService = inject(ProductAiExcelService);
  private readonly categoryStore = inject(CategoryStore);
  private readonly planStore = inject(PlanStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  public readonly cs = computed(() => this.tenantCurrency.localSymbol() || '$');
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(DialogComponent) dialog!: DialogComponent;

  public readonly view = signal<View>('hub');
  /** Export is a paid-plan feature; free plans see it disabled with a Pro hint. */
  public readonly isFreePlan = computed(() => this.planStore.isFreePlan());
  public readonly parsedRows = signal<ProductExcelRow[]>([]);
  public readonly importResults = signal<ImportRowResult[]>([]);
  public readonly importSummary = signal<ImportSummary | null>(null);
  public readonly importProgress = signal(0);
  public readonly aiStatusMessage = signal(AI_STATUS_MESSAGES[0]);
  private aiMessageInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAiMessages());
  }

  public open(): void {
    this.view.set('hub');
    this.parsedRows.set([]);
    this.importResults.set([]);
    this.importSummary.set(null);
    this.importProgress.set(0);
    this.categoryStore.categoryList$(1, 100);
    // Refrescamos el uso del plan para que el tile de Exportar muestre el
    // estado correcto (bloqueado + "Pro" en planes gratis) desde el inicio.
    this.planStore.refreshUsage();
    this.dialog.show();
  }

  /** From the hub, go to the import flow. */
  public onImport(): void {
    this.view.set('import-upload');
  }

  /** From the hub, request the export via WhatsApp. Paid plans only.
   *  Ya no se genera el Excel en el navegador: el equipo lo envía manualmente. */
  public onExport(): void {
    if (this.isFreePlan()) {
      toast.error('La exportación de productos está disponible en los planes pagos.');
      return;
    }
    const slug = localStorage.getItem('slug') ?? '';
    const message = encodeURIComponent(
      `Hola, quiero exportar los productos de mi catálogo${slug ? ` (${slug})` : ''} a Excel.`
    );
    // window.open debe ejecutarse síncrono dentro del click: un await previo
    // hace que Safari lo bloquee como popup.
    window.open(`https://wa.me/584220240947?text=${message}`, '_blank');
    this.dialog.hide();
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
    // El import creó productos: re-consultar el uso del plan para sincronizar
    // el límite (el PlanStore está cacheado).
    this.planStore.refreshUsage();
  }

  public downloadTemplate(): void {
    this.excelService.downloadTemplate();
  }

  public close(): void {
    this.dialog.hide();
  }

  private async processFile(file: File): Promise<void> {
    const result = await this.excelService.parseExcelFile(file);

    if (result.isRight()) {
      this.parsedRows.set(result.value);
      this.view.set('import-preview');
      return;
    }

    // Standard parse failed — try AI fallback
    this.view.set('ai-analyzing');
    this.startAiMessages();

    const rawResult = await this.excelService.extractRawData(file);

    if (rawResult.isLeft()) {
      this.stopAiMessages();
      toast.error(rawResult.value.message);
      this.view.set('import-upload');
      return;
    }

    const { headers, rows } = rawResult.value;
    const aiResult = await this.aiExcelService.aiParse(headers, rows);

    this.stopAiMessages();

    if (aiResult.isRight()) {
      this.parsedRows.set(aiResult.value);
      this.view.set('import-preview');
      toast.success('Archivo analizado con IA correctamente');
    } else {
      toast.error(aiResult.value.message);
      this.view.set('import-upload');
    }
  }

  private startAiMessages(): void {
    let index = 0;
    this.aiStatusMessage.set(AI_STATUS_MESSAGES[0]);
    this.aiMessageInterval = setInterval(() => {
      index = (index + 1) % AI_STATUS_MESSAGES.length;
      this.aiStatusMessage.set(AI_STATUS_MESSAGES[index]);
    }, 3000);
  }

  private stopAiMessages(): void {
    if (this.aiMessageInterval) {
      clearInterval(this.aiMessageInterval);
      this.aiMessageInterval = null;
    }
  }
}

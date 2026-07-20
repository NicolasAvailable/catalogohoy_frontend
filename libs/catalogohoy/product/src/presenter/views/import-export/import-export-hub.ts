import { DatePipe } from '@angular/common';
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
  ProductBackup,
  ProductExcelRow,
} from '../../../domain';
import {
  ProductAiExcelService,
  ProductBackupService,
  ProductExcelService,
  ProductStore,
} from '../../../infrastructure';

type View =
  | 'hub'
  | 'import-upload'
  | 'import-preview'
  | 'import-confirm'
  | 'import-progress'
  | 'import-done'
  | 'ai-analyzing'
  | 'backups';

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
    DatePipe,
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
  private readonly backupService = inject(ProductBackupService);
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

  /** Cancela el resto del import en curso (se muestra cuando ya hubo algún
   *  error, para no seguir procesando una lista que está fallando). */
  public readonly cancelRequested = signal(false);
  public readonly hasImportErrors = computed(() =>
    this.importResults().some((r) => r.status === 'error')
  );

  // ── Backups ──────────────────────────────────────────────────────────────
  public readonly backups = signal<ProductBackup[]>([]);
  public readonly loadingBackups = signal(false);
  public readonly isCreatingBackup = signal(false);
  public readonly isRestoring = signal(false);
  public readonly restoreProgress = signal(0);

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAiMessages());
  }

  public open(): void {
    this.view.set('hub');
    this.parsedRows.set([]);
    this.importResults.set([]);
    this.importSummary.set(null);
    this.importProgress.set(0);
    this.cancelRequested.set(false);
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

  /** Desde la preview: muestra el aviso de que se creará un backup antes de
   *  actualizar (no importa todavía). */
  public askImportConfirm(): void {
    this.view.set('import-confirm');
  }

  /** Pide cancelar el import en curso: el loop corta antes de la próxima fila
   *  (lo ya importado/actualizado queda; el backup previo permite restaurar). */
  public cancelImport(): void {
    this.cancelRequested.set(true);
  }

  /** Confirma el import: 1) crea un backup de seguridad (si falla, no toca
   *  nada), 2) valida el límite del plan SOLO sobre los productos nuevos (los
   *  existentes se actualizan y no consumen cupo), 3) corre el import con
   *  upsert (actualiza existentes por SKU/nombre, crea los nuevos). */
  public async confirmImport(): Promise<void> {
    const rows = this.parsedRows();

    // 1) Backup de seguridad — bloqueante: sin backup no importamos.
    this.isCreatingBackup.set(true);
    const backup = await this.backupService.createBackup('import');
    this.isCreatingBackup.set(false);
    if (backup.isLeft()) {
      toast.error('No se pudo crear el backup. No se realizó ningún cambio.');
      return;
    }

    // 2) Límite del plan solo sobre los NUEVOS.
    await this.planStore.refreshUsage();
    const remaining = this.planStore.remainingProducts();
    const existsFlags = await Promise.all(
      rows.map((r) => this.excelService.rowExists(r))
    );
    const newCount = existsFlags.filter((exists) => !exists).length;
    if (newCount > remaining) {
      toast.error(
        `La lista trae ${newCount} productos nuevos y tu plan permite ${remaining} más. Mejora tu plan para continuar.`
      );
      this.view.set('import-preview');
      return;
    }

    // 3) Import con upsert.
    this.view.set('import-progress');
    this.cancelRequested.set(false);
    const results: ImportRowResult[] = rows.map((data, i) => ({
      rowIndex: i,
      data,
      status: 'pending' as ImportRowStatus,
    }));
    this.importResults.set([...results]);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      if (this.cancelRequested()) {
        toast.info(
          `Importación cancelada: se procesaron ${i} de ${rows.length} filas.`
        );
        break;
      }
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
    // El import pudo crear productos: re-consultar el uso del plan (cacheado).
    this.planStore.refreshUsage();
  }

  // ── Backups: listar / descargar / restaurar ────────────────────────────
  /** Abre la vista de backups y los carga. */
  public async openBackups(): Promise<void> {
    this.view.set('backups');
    this.loadingBackups.set(true);
    const result = await this.backupService.listBackups();
    result
      .mapRight((list) => this.backups.set(list))
      .mapLeft((e) => toast.error(e.message));
    this.loadingBackups.set(false);
  }

  /** Descarga un backup como Excel. */
  public async downloadBackup(backup: ProductBackup): Promise<void> {
    const result = await this.backupService.getSnapshot(backup.id);
    result
      .mapRight((snapshot) =>
        this.excelService.exportSnapshotToExcel(
          snapshot,
          backup.createdAt.slice(0, 10)
        )
      )
      .mapLeft((e) => toast.error(e.message));
  }

  /** Restaura un backup: re-aplica el snapshot por upsert (actualiza los
   *  existentes a esa versión, re-crea los que falten). */
  public async restoreBackup(backup: ProductBackup): Promise<void> {
    if (this.isRestoring()) return;
    const confirmed = confirm(
      `¿Restaurar el respaldo del ${backup.createdAt.slice(0, 10)} (${backup.productCount} productos)? Tus productos volverán a esa versión.`
    );
    if (!confirmed) return;

    this.isRestoring.set(true);
    this.restoreProgress.set(0);

    const snapshotResult = await this.backupService.getSnapshot(backup.id);
    if (snapshotResult.isLeft()) {
      toast.error(snapshotResult.value.message);
      this.isRestoring.set(false);
      return;
    }
    const snapshot = snapshotResult.value;

    let fail = 0;
    for (let i = 0; i < snapshot.length; i++) {
      this.restoreProgress.set(Math.round((i / snapshot.length) * 100));
      const excelRow = this.excelService.snapshotRowToExcelRow(snapshot[i]);
      const r = await this.excelService.importRow(excelRow);
      r.mapLeft(() => fail++);
    }
    this.restoreProgress.set(100);
    this.isRestoring.set(false);
    this.productStore.productList$();
    this.planStore.refreshUsage();

    if (fail === 0) {
      toast.success(`Respaldo restaurado (${snapshot.length} productos).`);
    } else {
      toast.error(`Restaurado con ${fail} errores de ${snapshot.length}.`);
    }
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

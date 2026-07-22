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
import { FormsModule } from '@angular/forms';
import { E } from '@shared/domain';
import { CategoryStore } from '@catalogohoy/category';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { PlanStore } from '@catalogohoy/plan';
import {
  ButtonComponent,
  DialogComponent,
  IconComponent,
  ProgressBarComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
  UploaderService,
} from '@ui';
import { firstValueFrom } from 'rxjs';
import { toast } from 'ngx-sonner';
import {
  ImportRowResult,
  ImportRowStatus,
  ImportSummary,
  PdfCatalogPage,
  PdfParsedProduct,
  ProductBackup,
  ProductBackupSnapshotRow,
  ProductExcelRow,
} from '../../../domain';
import {
  AiImageService,
  CreditsStore,
  ImportEventsService,
  PdfCatalogService,
  ProductAiExcelService,
  ProductAiPdfService,
  ProductBackupService,
  ProductExcelService,
  ProductService,
  ProductStore,
} from '../../../infrastructure';

type View =
  | 'hub'
  | 'import-source'
  | 'import-upload'
  | 'import-gsheet'
  | 'import-preview'
  | 'import-confirm'
  | 'import-progress'
  | 'import-done'
  | 'ai-analyzing'
  | 'pdf-upload'
  | 'pdf-confirm'
  | 'pdf-photos-matching'
  | 'backups'
  | 'backup-view'
  | 'photos-upload'
  | 'photos-review'
  | 'photos-progress'
  | 'photos-done';

/** Una foto del import masivo: archivo local + producto asignado (o null). */
interface PhotoImportItem {
  file: File;
  previewUrl: string;
  productId: string | null;
  method: 'sku' | 'nombre' | 'ia' | 'manual' | null;
}

/** Opción de producto para asignar fotos (con miniatura actual). */
interface PhotoProductOption {
  id: string;
  name: string;
  sku: string | null;
  photo: string | null;
}

/** Foto recortada del PDF, lista para el flujo de asignación. */
interface PdfImageItem {
  page: number;
  file: File;
  previewUrl: string;
}

const AI_STATUS_MESSAGES = [
  { text: 'Analizando tu archivo...', icon: 'sparkles' },
  { text: 'Identificando columnas...', icon: 'search' },
  { text: 'Mapeando datos...', icon: 'arrow-up-down' },
  { text: 'Normalizando informacion...', icon: 'wand-sparkles' },
  { text: 'Preparando vista previa...', icon: 'eye' },
];

/** Mensajes del parseo LOCAL del PDF (pdf.js — no consume créditos). */
const PDF_READ_MESSAGES = [
  { text: 'Leyendo tu PDF...', icon: 'file-text' },
  { text: 'Extrayendo el texto de cada página...', icon: 'search' },
  { text: 'Detectando las fotos de productos...', icon: 'image' },
];

/** Mensajes mientras la IA estructura los productos. */
const PDF_AI_MESSAGES = [
  { text: 'La IA está leyendo tu catálogo...', icon: 'sparkles' },
  { text: 'Detectando productos y precios...', icon: 'search' },
  { text: 'Armando la lista de productos...', icon: 'wand-sparkles' },
  { text: 'Preparando vista previa...', icon: 'eye' },
];

/** Mensajes mientras la IA identifica las fotos del PDF. */
const PDF_MATCH_MESSAGES = [
  { text: 'La IA está identificando las fotos...', icon: 'image' },
  { text: 'Comparando cada foto con los productos de su página...', icon: 'search' },
  { text: 'Asignando fotos a los productos...', icon: 'wand-sparkles' },
  { text: 'Ya casi terminamos...', icon: 'sparkles' },
];

// Topes anti-espera-eterna: si algo se cuelga, el flujo muestra un toast y
// vuelve a una vista estable en vez de dejar al cliente mirando el spinner.
/** Watchdog del parseo local del PDF: máximo sin avanzar de página. */
const PDF_PARSE_IDLE_MS = 45_000;
/** Llamadas a la IA (las edge functions cortan alrededor de los 150s). */
const AI_CALL_TIMEOUT_MS = 150_000;
const AI_MATCH_TIMEOUT_MS = 90_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const DB_ROW_TIMEOUT_MS = 30_000;
const BACKUP_TIMEOUT_MS = 45_000;

@Component({
  selector: 'lib-import-export-hub',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    DialogComponent,
    ButtonComponent,
    IconComponent,
    ProgressBarComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
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
  private readonly productService = inject(ProductService);
  private readonly excelService = inject(ProductExcelService);
  private readonly aiExcelService = inject(ProductAiExcelService);
  private readonly backupService = inject(ProductBackupService);
  private readonly aiImageService = inject(AiImageService);
  private readonly pdfCatalogService = inject(PdfCatalogService);
  private readonly aiPdfService = inject(ProductAiPdfService);
  private readonly importEvents = inject(ImportEventsService);
  public readonly credits = inject(CreditsStore);
  private readonly uploaderService = inject(UploaderService);
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
  /** Por fila del preview: true = ya existe (se ACTUALIZARÁ), false = nuevo.
   *  Vacío mientras se calcula o si el chequeo falló. */
  public readonly existingFlags = signal<boolean[]>([]);
  public readonly updateCount = computed(
    () => this.existingFlags().filter(Boolean).length
  );
  public readonly newCount = computed(
    () => this.parsedRows().length - this.updateCount()
  );
  public readonly flagsReady = computed(
    () => this.existingFlags().length === this.parsedRows().length
  );
  public readonly importResults = signal<ImportRowResult[]>([]);
  public readonly importSummary = signal<ImportSummary | null>(null);
  public readonly importProgress = signal(0);
  public readonly aiStatusMessage = signal(AI_STATUS_MESSAGES[0]);
  private aiMessageInterval: ReturnType<typeof setInterval> | null = null;

  /** Cancela el resto del import en curso (se muestra cuando ya hubo algún
   *  error o está en pausa, para no seguir procesando una lista que falla). */
  public readonly cancelRequested = signal(false);
  /** Pausa el import entre fila y fila; Reanudar continúa donde quedó. */
  public readonly isPaused = signal(false);
  public readonly hasImportErrors = computed(() =>
    this.importResults().some((r) => r.status === 'error')
  );

  // ── Importar catálogo desde PDF (IA) ─────────────────────────────────────
  /** Texto por página del PDF parseado localmente (aún sin gastar créditos). */
  public readonly pdfPages = signal<PdfCatalogPage[]>([]);
  /** Fotos recortadas del PDF, con su página (para el matching). */
  public readonly pdfImageItems = signal<PdfImageItem[]>([]);
  /** Productos estructurados por la IA (conservan la página). */
  public readonly pdfParsed = signal<PdfParsedProduct[]>([]);
  /** true cuando el import en curso vino de un PDF (habilita el paso de fotos). */
  public readonly isPdfRun = signal(false);
  public readonly pdfFileName = signal('');
  public readonly isMatchingPdfPhotos = signal(false);
  public readonly pdfMatchProgress = signal(0);
  public readonly pdfMatchDone = signal(0);
  public readonly pdfMatchTotal = signal(0);
  /** Invalida resultados tardíos del parseo cuando el watchdog abortó. */
  private pdfOpToken = 0;
  /** Costo del análisis con IA: 1 crédito por página con texto. */
  public readonly pdfAnalyzeCost = computed(() => this.pdfPages().length);
  /** true si el saldo cargado no cubre el análisis completo del PDF. */
  public readonly pdfInsufficientCredits = computed(() => {
    const balance = this.credits.balance();
    return balance !== null && balance < this.pdfAnalyzeCost();
  });

  // ── Backups ──────────────────────────────────────────────────────────────
  public readonly backups = signal<ProductBackup[]>([]);
  public readonly loadingBackups = signal(false);
  public readonly isCreatingBackup = signal(false);
  public readonly isRestoring = signal(false);
  public readonly restoreProgress = signal(0);
  /** Backup abierto en el visor (vista tipo planilla) + sus filas. */
  public readonly viewingBackup = signal<ProductBackup | null>(null);
  public readonly backupRows = signal<ProductBackupSnapshotRow[]>([]);
  public readonly loadingBackupRows = signal(false);

  // ── Import masivo de fotos ────────────────────────────────────────────────
  public readonly photoItems = signal<PhotoImportItem[]>([]);
  public readonly photoProducts = signal<PhotoProductOption[]>([]);
  public readonly loadingPhotoProducts = signal(false);
  public readonly photosProgress = signal(0);
  public readonly photosCurrentLabel = signal('');
  public readonly isApplyingPhotos = signal(false);
  public readonly photosApplied = signal(0);
  public readonly photosSkippedCap = signal(0);
  public readonly photosFailed = signal(0);
  public readonly photoAssignedCount = computed(
    () => this.photoItems().filter((i) => i.productId !== null).length
  );
  public readonly photoUnassignedCount = computed(
    () => this.photoItems().length - this.photoAssignedCount()
  );
  /** Cap de fotos por producto según el plan (mismo criterio que el editor). */
  private readonly photosLimitByPlan: Record<string, number> = {
    gratis: 3,
    basico: 10,
    avanzado: 50,
    enterprise: 0, // 0 = ilimitado
  };
  private maxPhotosPerProduct(): number {
    const planId = this.planStore.currentPlan()?.id ?? 'gratis';
    return this.photosLimitByPlan[planId] ?? 3;
  }

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
    this.isPaused.set(false);
    this.clearPhotoItems();
    this.clearPdfState();
    this.categoryStore.categoryList$(1, 100);
    // Refrescamos el uso del plan para que el tile de Exportar muestre el
    // estado correcto (bloqueado + "Pro" en planes gratis) desde el inicio.
    this.planStore.refreshUsage();
    this.dialog.show();
  }

  /** From the hub, go to the source picker (Excel / Google Sheets). */
  public onImport(): void {
    this.view.set('import-source');
  }

  // ── Google Sheets ────────────────────────────────────────────────────────
  public readonly gsheetUrl = signal('');
  public readonly isFetchingSheet = signal(false);

  /** Importa desde un link de Google Sheets (compartido como "cualquiera con
   *  el enlace"). Se baja como CSV vía el endpoint gviz (soporta CORS) y entra
   *  al MISMO pipeline que un archivo subido (parseo normal + fallback IA). */
  public async importGoogleSheet(): Promise<void> {
    const url = this.gsheetUrl().trim();
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      toast.error('El link no parece ser de Google Sheets.');
      return;
    }
    const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
    const csvUrl =
      `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv` +
      (gid ? `&gid=${gid}` : '');

    this.isFetchingSheet.set(true);
    try {
      const res = await fetch(csvUrl);
      const text = await res.text();
      // Si la hoja no es pública, Google devuelve HTML (página de login).
      if (!res.ok || text.trimStart().startsWith('<')) {
        toast.error(
          'No pudimos leer la hoja. En Google Sheets: Compartir → "Cualquier persona con el enlace".'
        );
        return;
      }
      const file = new File([text], 'google-sheet.csv', { type: 'text/csv' });
      await this.processFile(file, 'import-gsheet');
    } catch {
      // Una hoja privada redirige (302) al login de Google y el navegador lo
      // bloquea por CORS → el fetch LANZA. La causa más común de caer acá es
      // que la hoja no está compartida, no un problema de conexión.
      toast.error(
        'No pudimos leer la hoja. Verifica que esté compartida como "Cualquier persona con el enlace" (Compartir → Acceso general) e intenta de nuevo.'
      );
    } finally {
      this.isFetchingSheet.set(false);
    }
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
    this.isPaused.set(false);
  }

  /** Pausa/reanuda el import (el loop espera entre fila y fila). */
  public togglePause(): void {
    this.isPaused.update((p) => !p);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Race con timeout para promesas Either: si no resuelve a tiempo devuelve
   *  Left, así el caller muestra su toast y sale del estado de carga. */
  private withEitherTimeout<R>(
    promise: Promise<E.Either<Error, R>>,
    ms: number,
    message: string
  ): Promise<E.Either<Error, R>> {
    return Promise.race([
      promise,
      new Promise<E.Either<Error, R>>((resolve) =>
        setTimeout(() => resolve(E.left(new Error(message))), ms)
      ),
    ]);
  }

  /** Confirma el import: 1) crea un backup de seguridad (si falla, no toca
   *  nada), 2) valida el límite del plan SOLO sobre los productos nuevos (los
   *  existentes se actualizan y no consumen cupo), 3) corre el import con
   *  upsert (actualiza existentes por SKU/nombre, crea los nuevos). */
  public async confirmImport(): Promise<void> {
    const rows = this.parsedRows();

    // 1) Backup de seguridad — bloqueante: sin backup no importamos. El spinner
    //    del botón cubre TODO el pre-proceso (backup + chequeo del plan), no
    //    solo el backup, para que nunca parezca colgado.
    this.isCreatingBackup.set(true);
    const backup = await this.withEitherTimeout(
      this.backupService.createBackup('import'),
      BACKUP_TIMEOUT_MS,
      'El respaldo tardó demasiado. Intenta de nuevo.'
    );
    if (backup.isLeft()) {
      this.isCreatingBackup.set(false);
      toast.error('No se pudo crear el backup. No se realizó ningún cambio.');
      this.importEvents.notify('backup-error', backup.value.message);
      return;
    }
    toast.success('Respaldo creado');

    // 2) Límite del plan solo sobre los NUEVOS. Reusa los flags calculados al
    //    entrar al preview; si no llegaron (falló/no terminó), recalcula.
    await this.planStore.refreshUsage();
    const remaining = this.planStore.remainingProducts();
    let flags = this.existingFlags();
    if (flags.length !== rows.length) {
      flags = await this.excelService
        .markExistingRows(rows)
        .catch(() => [] as boolean[]);
    }
    const newCount =
      flags.length === rows.length
        ? flags.filter((exists) => !exists).length
        : rows.length; // sin flags: conservador, todos cuentan como nuevos
    this.isCreatingBackup.set(false);
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
    this.isPaused.set(false);
    const results: ImportRowResult[] = rows.map((data, i) => ({
      rowIndex: i,
      data,
      status: 'pending' as ImportRowStatus,
    }));
    this.importResults.set([...results]);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      // Pausa: espera entre fila y fila hasta Reanudar (o Cancelar).
      while (this.isPaused() && !this.cancelRequested()) {
        await this.sleep(200);
      }
      if (this.cancelRequested()) {
        toast.info(
          `Importación cancelada: se procesaron ${i} de ${rows.length} filas.`
        );
        break;
      }
      results[i] = { ...results[i], status: 'importing' };
      this.importResults.set([...results]);
      this.importProgress.set(Math.round((i / rows.length) * 100));

      const result = await this.withEitherTimeout(
        this.excelService.importRow(rows[i]),
        DB_ROW_TIMEOUT_MS,
        'La fila tardó demasiado en procesarse.'
      );
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
    if (errorCount > 0) {
      this.importEvents.notify(
        'import-rows-error',
        `${errorCount} de ${rows.length} filas fallaron${this.isPdfRun() ? ' (fuente: PDF)' : ''}`
      );
    } else if (this.isPdfRun()) {
      this.importEvents.notify(
        'pdf-import-ok',
        `${successCount} productos importados desde ${this.pdfFileName()}`
      );
    }
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
    const result = await this.withEitherTimeout(
      this.backupService.listBackups(),
      DB_ROW_TIMEOUT_MS,
      'Los respaldos tardaron demasiado en cargar. Intenta de nuevo.'
    );
    result
      .mapRight((list) => this.backups.set(list))
      .mapLeft((e) => toast.error(e.message));
    this.loadingBackups.set(false);
  }

  /** Abre un backup en el visor (tabla tipo planilla, como en Excel). */
  public async viewBackup(backup: ProductBackup): Promise<void> {
    this.viewingBackup.set(backup);
    this.backupRows.set([]);
    this.view.set('backup-view');
    this.loadingBackupRows.set(true);
    const result = await this.withEitherTimeout(
      this.backupService.getSnapshot(backup.id),
      DB_ROW_TIMEOUT_MS,
      'El respaldo tardó demasiado en cargar. Intenta de nuevo.'
    );
    result
      .mapRight((snapshot) => this.backupRows.set(snapshot))
      .mapLeft((e) => {
        toast.error(e.message);
        this.view.set('backups');
      });
    this.loadingBackupRows.set(false);
  }

  /** Descarga un backup como Excel. */
  public async downloadBackup(backup: ProductBackup): Promise<void> {
    const result = await this.withEitherTimeout(
      this.backupService.getSnapshot(backup.id),
      DB_ROW_TIMEOUT_MS,
      'El respaldo tardó demasiado en cargar. Intenta de nuevo.'
    );
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

    const snapshotResult = await this.withEitherTimeout(
      this.backupService.getSnapshot(backup.id),
      DB_ROW_TIMEOUT_MS,
      'El respaldo tardó demasiado en cargar. Intenta de nuevo.'
    );
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
      const r = await this.withEitherTimeout(
        this.excelService.importRow(excelRow),
        DB_ROW_TIMEOUT_MS,
        'La fila tardó demasiado en procesarse.'
      );
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

  // ── Import masivo de fotos ────────────────────────────────────────────────
  /** Abre el flujo de fotos: carga los productos del tenant para el matching
   *  y el selector de asignación. */
  public async openPhotosImport(): Promise<void> {
    this.clearPhotoItems();
    this.view.set('photos-upload');
    this.loadingPhotoProducts.set(true);
    await this.productStore.productList$();
    this.photoProducts.set(
      this.productStore.productList().products.map((p) => ({
        id: String(p.id),
        name: p.name,
        sku: p.sku ?? null,
        photo: p.photos?.[0] ?? null,
      }))
    );
    this.loadingPhotoProducts.set(false);
  }

  public onPhotoFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addPhotoFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  public onPhotoDrop(event: DragEvent): void {
    event.preventDefault();
    this.addPhotoFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  /** Agrega archivos al lote, corre el auto-match por nombre de archivo
   *  (SKU exacto → nombre normalizado → substring único) y pasa a revisión. */
  private addPhotoFiles(files: File[]): void {
    const images = files.filter((f) =>
      (f.type || '').toLowerCase().startsWith('image/')
    );
    if (!images.length) return;

    const options = this.photoProducts();
    const items: PhotoImportItem[] = images.map((file) => {
      const match = this.matchPhotoToProduct(file.name, options);
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        productId: match?.productId ?? null,
        method: match?.method ?? null,
      };
    });
    this.photoItems.update((cur) => [...cur, ...items]);
    this.view.set('photos-review');
  }

  /** Matching en cascada. Ambigüedad (varios candidatos) => null → a revisar. */
  private matchPhotoToProduct(
    fileName: string,
    options: PhotoProductOption[]
  ): { productId: string; method: 'sku' | 'nombre' } | null {
    const base = fileName.replace(/\.[^.]+$/, '').trim();
    // Variantes del nombre: tal cual y sin sufijo de copia ("-1", " (2)", "_3").
    const candidates = [
      base,
      base.replace(/[\s_-]*\(?\d+\)?$/, '').trim(),
    ].filter((c, i, arr) => c && arr.indexOf(c) === i);

    // 1) SKU exacto (case-insensitive; conserva guiones).
    for (const c of candidates) {
      const lower = c.toLowerCase();
      const bySku = options.filter((o) => o.sku?.toLowerCase() === lower);
      if (bySku.length === 1) {
        return { productId: bySku[0].id, method: 'sku' };
      }
    }

    // 2) Nombre normalizado (sin acentos/símbolos) exacto, luego substring
    //    único. Con más de un candidato NO se asigna (queda a revisar).
    for (const c of candidates) {
      const norm = this.normalizePhotoText(c);
      if (!norm) continue;
      const exact = options.filter(
        (o) => this.normalizePhotoText(o.name) === norm
      );
      if (exact.length === 1) {
        return { productId: exact[0].id, method: 'nombre' };
      }
      const contains = options.filter((o) => {
        const on = this.normalizePhotoText(o.name);
        return on.includes(norm) || norm.includes(on);
      });
      if (contains.length === 1) {
        return { productId: contains[0].id, method: 'nombre' };
      }
    }

    return null;
  }

  private normalizePhotoText(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Asigna/corrige el producto de una foto desde el selector (null = quitar). */
  public assignPhoto(index: number, productId: string | null): void {
    this.photoItems.update((items) => {
      const next = [...items];
      next[index] = {
        ...next[index],
        productId,
        method: productId ? 'manual' : null,
      };
      return next;
    });
  }

  public removePhotoItem(index: number): void {
    this.photoItems.update((items) => {
      const next = [...items];
      URL.revokeObjectURL(next[index]?.previewUrl ?? '');
      next.splice(index, 1);
      return next;
    });
  }

  // ── Identificación con IA (Fase 2) ───────────────────────────────────────
  public readonly aiIdentifying = signal(false);

  /** Manda las fotos SIN asignar a la IA (miniaturas + lista de productos del
   *  tenant) para que identifique a qué producto pertenece cada una. Cobra
   *  1 crédito de IA por foto. Lotes de a 20. */
  public async identifyWithAi(): Promise<void> {
    if (this.aiIdentifying()) return;
    const unassigned = this.photoItems()
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.productId === null);
    if (!unassigned.length) return;

    this.aiIdentifying.set(true);
    const products = this.photoProducts().map((o) => ({
      id: o.id,
      name: o.name,
      sku: o.sku,
    }));
    let identified = 0;

    for (let start = 0; start < unassigned.length; start += 20) {
      const batch = unassigned.slice(start, start + 20);
      const images: { id: string; data: string }[] = [];
      const indexById = new Map<string, number>();
      for (let b = 0; b < batch.length; b++) {
        const data = await this.photoThumbnailB64(batch[b].item.file);
        if (!data) continue;
        const id = `p${start + b}`;
        images.push({ id, data });
        indexById.set(id, batch[b].index);
      }
      if (!images.length) continue;

      const result = await this.withEitherTimeout(
        this.aiImageService.matchPhotos(images, products),
        AI_MATCH_TIMEOUT_MS,
        'La IA está tardando demasiado en identificar las fotos. Intenta de nuevo.'
      );
      if (result.isLeft()) {
        // Cortar (no quemar más lotes si p. ej. se acabaron los créditos).
        toast.error(result.value.message);
        this.importEvents.notify('fotos-ia-error', result.value.message);
        break;
      }
      this.photoItems.update((items) => {
        const next = [...items];
        for (const m of result.value) {
          const idx = indexById.get(m.id);
          if (idx === undefined || !m.productId) continue;
          // No pisar una asignación hecha a mano mientras corría la IA.
          if (next[idx].productId !== null) continue;
          next[idx] = { ...next[idx], productId: m.productId, method: 'ia' };
          identified++;
        }
        return next;
      });
    }

    this.aiIdentifying.set(false);
    if (identified > 0) {
      toast.success(`La IA identificó ${identified} foto(s)`);
    } else {
      toast.info('La IA no pudo identificar ninguna foto con seguridad.');
    }
  }

  /** Miniatura JPEG base64 (sin prefijo) para mandar a la IA — chica y barata
   *  en tokens; no hace falta subir la foto original para identificarla. */
  private photoThumbnailB64(file: File, maxSide = 384): Promise<string | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl.split(',')[1] ?? null);
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  public photoProductLabel(productId: string | null): string {
    if (!productId) return '';
    return this.photoProducts().find((o) => o.id === productId)?.name ?? '';
  }

  private clearPhotoItems(): void {
    for (const item of this.photoItems()) {
      URL.revokeObjectURL(item.previewUrl);
    }
    this.photoItems.set([]);
    this.photosProgress.set(0);
    this.photosCurrentLabel.set('');
    this.photosApplied.set(0);
    this.photosSkippedCap.set(0);
    this.photosFailed.set(0);
  }

  /** Aplica: respaldo previo → sube cada foto asignada (comprimida, a Storage)
   *  → append a las fotos del producto respetando el cap del plan. Las fotos
   *  sin asignar NO se suben (no gastan storage). */
  public async applyPhotos(): Promise<void> {
    if (this.isApplyingPhotos()) return;
    const assigned = this.photoItems().filter((i) => i.productId !== null);
    if (!assigned.length) return;

    this.isApplyingPhotos.set(true);
    const backup = await this.withEitherTimeout(
      this.backupService.createBackup('fotos'),
      BACKUP_TIMEOUT_MS,
      'El respaldo tardó demasiado. Intenta de nuevo.'
    );
    if (backup.isLeft()) {
      toast.error('No se pudo crear el respaldo. No se realizó ningún cambio.');
      this.importEvents.notify('backup-error', backup.value.message);
      this.isApplyingPhotos.set(false);
      return;
    }

    this.photosApplied.set(0);
    this.photosSkippedCap.set(0);
    this.photosFailed.set(0);
    this.photosProgress.set(0);
    this.view.set('photos-progress');

    // Agrupar por producto para hacer un solo update por producto.
    const groups = new Map<string, PhotoImportItem[]>();
    for (const item of assigned) {
      const key = item.productId as string;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    const maxPhotos = this.maxPhotosPerProduct();
    let processed = 0;

    for (const [productId, groupItems] of groups) {
      const urls: string[] = [];
      for (const item of groupItems) {
        this.photosCurrentLabel.set(item.file.name);
        try {
          const output = await firstValueFrom(
            this.uploaderService.upload(item.file)
          );
          const result = await this.withEitherTimeout(
            output.complete(),
            UPLOAD_TIMEOUT_MS,
            'La subida de la foto tardó demasiado.'
          );
          result
            .mapRight((url: string) => urls.push(url))
            .mapLeft(() => this.photosFailed.update((n) => n + 1));
        } catch {
          this.photosFailed.update((n) => n + 1);
        }
        processed++;
        this.photosProgress.set(Math.round((processed / assigned.length) * 100));
      }

      if (urls.length) {
        const result = await this.productService.appendPhotos(
          productId,
          urls,
          maxPhotos
        );
        result
          .mapRight(({ added, skipped }) => {
            this.photosApplied.update((n) => n + added);
            this.photosSkippedCap.update((n) => n + skipped);
          })
          .mapLeft(() => this.photosFailed.update((n) => n + urls.length));
      }
    }

    this.photosProgress.set(100);
    this.isApplyingPhotos.set(false);
    if (this.photosFailed() > 0) {
      this.importEvents.notify(
        'fotos-error',
        `${this.photosFailed()} foto(s) fallaron al subir/aplicar`
      );
    }
    this.view.set('photos-done');
    this.productStore.productList$();
  }

  // ── Importar catálogo desde PDF (IA) ─────────────────────────────────────
  public async onPdfSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.processPdfFile(file);
    input.value = '';
  }

  public async onPdfDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    await this.processPdfFile(file);
  }

  /** Parsea el PDF localmente (texto + fotos, sin gastar créditos) y muestra
   *  la confirmación con el costo del análisis antes de llamar a la IA. */
  private async processPdfFile(file: File): Promise<void> {
    const isPdf =
      file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      toast.error('El archivo debe ser un PDF.');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error('El PDF supera los 30 MB. Divide el catálogo e intenta de nuevo.');
      return;
    }

    this.clearPdfState();
    this.pdfFileName.set(file.name);
    this.view.set('ai-analyzing');
    this.startAiMessages(PDF_READ_MESSAGES);

    // Watchdog: pdf.js puede colgarse sin rechazar la promesa (p. ej. si el
    // worker muere). Si no avanza de página en PDF_PARSE_IDLE_MS, cortamos
    // con toast en vez de dejar el spinner eterno; el token descarta un
    // resultado que llegue tarde.
    const token = ++this.pdfOpToken;
    let lastProgress = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - lastProgress < PDF_PARSE_IDLE_MS) return;
      clearInterval(watchdog);
      if (token !== this.pdfOpToken) return;
      this.pdfOpToken++;
      this.stopAiMessages();
      toast.error(
        'La lectura del PDF está tardando demasiado. Prueba con un archivo más liviano.'
      );
      this.importEvents.notify('pdf-import-timeout', this.pdfFileName());
      this.view.set('pdf-upload');
    }, 5000);

    const result = await this.pdfCatalogService.parse(file, () => {
      lastProgress = Date.now();
    });
    clearInterval(watchdog);
    if (token !== this.pdfOpToken) return; // abortado por el watchdog
    this.stopAiMessages();

    if (result.isLeft()) {
      toast.error(result.value.message);
      this.importEvents.notify(
        'pdf-import-error',
        `${this.pdfFileName()}: ${result.value.message}`
      );
      this.view.set('pdf-upload');
      return;
    }

    const { pages, images } = result.value;
    this.pdfPages.set(pages);
    this.pdfImageItems.set(
      images.map((img, i) => ({
        page: img.page,
        file: new File([img.blob], `pagina-${img.page}-foto-${i + 1}.jpg`, {
          type: 'image/jpeg',
        }),
        previewUrl: URL.createObjectURL(img.blob),
      }))
    );
    // Saldo fresco para mostrar "tienes N créditos" junto al costo.
    void this.credits.load();
    this.view.set('pdf-confirm');
  }

  /** Manda el texto por página a la IA (cobra 1 crédito/página) y entra al
   *  MISMO preview del import de Excel: backup + límite del plan + upsert. */
  public async analyzePdf(): Promise<void> {
    const pages = this.pdfPages();
    if (!pages.length) return;

    this.view.set('ai-analyzing');
    this.startAiMessages(PDF_AI_MESSAGES);

    // PDFs grandes de un solo golpe: se analiza en lotes de 40 páginas en
    // serie (la edge function acepta hasta 80 por llamada). El costo total ya
    // se mostró en pdf-confirm; cada lote cobra solo sus páginas, así que si
    // uno falla a mitad de camino seguimos con lo ya analizado (y cobrado).
    const products: PdfParsedProduct[] = [];
    let analyzedPages = 0;
    let failure: Error | null = null;
    for (let start = 0; start < pages.length; start += 40) {
      const chunk = pages.slice(start, start + 40);
      const result = await this.withEitherTimeout(
        this.aiPdfService.parsePages(chunk),
        AI_CALL_TIMEOUT_MS,
        'La IA está tardando demasiado en leer el catálogo. Intenta de nuevo.'
      );
      if (result.isLeft()) {
        failure = result.value;
        break;
      }
      products.push(...result.value);
      analyzedPages += chunk.length;
    }
    this.stopAiMessages();

    if (!products.length) {
      toast.error(failure?.message ?? 'La IA no encontró productos en el PDF.');
      this.importEvents.notify(
        'pdf-ia-error',
        `${this.pdfFileName()} (${pages.length} págs): ${failure?.message ?? 'sin productos'}`
      );
      this.view.set('pdf-confirm');
      return;
    }
    if (failure) {
      toast.info(
        `Se analizaron ${analyzedPages} de ${pages.length} páginas (${failure.message}). Puedes importar lo detectado y repetir luego con el resto.`
      );
      this.importEvents.notify(
        'pdf-ia-error',
        `${this.pdfFileName()}: lote falló tras ${analyzedPages}/${pages.length} págs — ${failure.message}`
      );
    }

    this.pdfParsed.set(products);
    this.isPdfRun.set(true);
    const rows: ProductExcelRow[] = products.map((p) => ({
      name: p.name,
      description: '',
      price: p.price,
      pricePromotional: null,
      stock: null,
      sku: null,
      productionCost: null,
      categories: '',
    }));
    this.enterPreview(rows);
    toast.success(`La IA encontró ${products.length} productos en el PDF`);
  }

  /** Tras importar: asigna las fotos del PDF a los productos. El matching es
   *  por página (la IA solo elige entre los productos de ESA página — más
   *  barato y preciso). Cobra 1 crédito por foto. Después cae en la revisión
   *  normal de fotos y aplica con el mismo pipeline (backup + cap del plan). */
  public async assignPdfPhotos(): Promise<void> {
    const images = this.pdfImageItems();
    if (!images.length || this.isMatchingPdfPhotos()) return;

    this.isMatchingPdfPhotos.set(true);
    this.pdfMatchProgress.set(0);
    this.pdfMatchDone.set(0);
    this.pdfMatchTotal.set(images.length);
    this.view.set('pdf-photos-matching');
    this.startAiMessages(PDF_MATCH_MESSAGES);

    // Lista fresca del tenant (incluye lo recién importado): alimenta el
    // selector de la revisión y resuelve nombre → id de lo parseado.
    await this.productStore.productList$();
    const options: PhotoProductOption[] = this.productStore
      .productList()
      .products.map((p) => ({
        id: String(p.id),
        name: p.name,
        sku: p.sku ?? null,
        photo: p.photos?.[0] ?? null,
      }));
    this.photoProducts.set(options);

    const idByName = new Map<string, string>();
    for (const o of options) {
      idByName.set(this.normalizePhotoText(o.name), o.id);
    }
    const productsByPage = new Map<
      number,
      { id: string; name: string; sku: string | null }[]
    >();
    for (const parsed of this.pdfParsed()) {
      const id = idByName.get(this.normalizePhotoText(parsed.name));
      if (!id) continue;
      const list = productsByPage.get(parsed.page) ?? [];
      if (!list.some((x) => x.id === id)) {
        list.push({ id, name: parsed.name, sku: null });
      }
      productsByPage.set(parsed.page, list);
    }

    const items: PhotoImportItem[] = images.map((img) => ({
      file: img.file,
      previewUrl: img.previewUrl,
      productId: null,
      method: null,
    }));
    const indicesByPage = new Map<number, number[]>();
    images.forEach((img, i) => {
      indicesByPage.set(img.page, [...(indicesByPage.get(img.page) ?? []), i]);
    });

    let done = 0;
    outer: for (const [page, indices] of indicesByPage) {
      const candidates = productsByPage.get(page) ?? [];
      if (!candidates.length) {
        done += indices.length;
        this.pdfMatchDone.set(done);
        this.pdfMatchProgress.set(Math.round((done / images.length) * 100));
        continue;
      }
      for (let start = 0; start < indices.length; start += 20) {
        const batch = indices.slice(start, start + 20);
        const payload: { id: string; data: string }[] = [];
        const indexById = new Map<string, number>();
        for (const idx of batch) {
          const data = await this.photoThumbnailB64(items[idx].file);
          if (!data) continue;
          const id = `img${idx}`;
          payload.push({ id, data });
          indexById.set(id, idx);
        }
        if (payload.length) {
          const result = await this.withEitherTimeout(
            this.aiImageService.matchPhotos(payload, candidates),
            AI_MATCH_TIMEOUT_MS,
            'La IA está tardando demasiado en identificar las fotos. Intenta de nuevo.'
          );
          if (result.isLeft()) {
            // Cortar (p. ej. créditos agotados): lo matcheado hasta acá queda.
            toast.error(result.value.message);
            this.importEvents.notify('fotos-ia-error', result.value.message);
            break outer;
          }
          for (const m of result.value) {
            const idx = indexById.get(m.id);
            if (idx === undefined || !m.productId) continue;
            items[idx] = { ...items[idx], productId: m.productId, method: 'ia' };
          }
        }
        done += batch.length;
        this.pdfMatchDone.set(done);
        this.pdfMatchProgress.set(Math.round((done / images.length) * 100));
      }
    }

    this.stopAiMessages();
    this.photoItems.set(items);
    // La propiedad de los object URLs pasa a photoItems (clearPhotoItems los
    // revoca); vaciamos sin revocar para no matar los previews.
    this.pdfImageItems.set([]);
    this.isMatchingPdfPhotos.set(false);
    this.view.set('photos-review');
  }

  private clearPdfState(): void {
    for (const item of this.pdfImageItems()) {
      URL.revokeObjectURL(item.previewUrl);
    }
    this.pdfPages.set([]);
    this.pdfImageItems.set([]);
    this.pdfParsed.set([]);
    this.pdfFileName.set('');
    this.isPdfRun.set(false);
    this.pdfMatchProgress.set(0);
  }

  /** Entra al preview: setea las filas y calcula (en background) qué filas ya
   *  existen para los badges "Nuevo"/"Se actualizará" y el chequeo del plan. */
  private enterPreview(rows: ProductExcelRow[]): void {
    this.parsedRows.set(rows);
    this.existingFlags.set([]);
    this.view.set('import-preview');
    this.excelService
      .markExistingRows(rows)
      .then((flags) => this.existingFlags.set(flags))
      .catch(() => this.existingFlags.set([]));
  }

  private async processFile(
    file: File,
    returnView: View = 'import-upload'
  ): Promise<void> {
    // Un import de Excel/Sheets no habilita el paso de fotos del PDF.
    this.isPdfRun.set(false);
    const result = await this.excelService.parseExcelFile(file);

    if (result.isRight()) {
      this.enterPreview(result.value);
      return;
    }

    // Standard parse failed — try AI fallback
    this.view.set('ai-analyzing');
    this.startAiMessages();

    const rawResult = await this.excelService.extractRawData(file);

    if (rawResult.isLeft()) {
      this.stopAiMessages();
      toast.error(rawResult.value.message);
      this.importEvents.notify(
        'excel-parse-error',
        `${file.name}: ${rawResult.value.message}`
      );
      this.view.set(returnView);
      return;
    }

    const { headers, rows } = rawResult.value;
    const aiResult = await this.withEitherTimeout(
      this.aiExcelService.aiParse(headers, rows),
      AI_CALL_TIMEOUT_MS,
      'La IA está tardando demasiado en analizar el archivo. Intenta de nuevo.'
    );

    this.stopAiMessages();

    if (aiResult.isRight()) {
      this.enterPreview(aiResult.value);
      toast.success('Archivo analizado con IA correctamente');
    } else {
      toast.error(aiResult.value.message);
      this.importEvents.notify(
        'excel-ia-error',
        `${file.name}: ${aiResult.value.message}`
      );
      this.view.set(returnView);
    }
  }

  private startAiMessages(messages = AI_STATUS_MESSAGES): void {
    let index = 0;
    this.aiStatusMessage.set(messages[0]);
    this.aiMessageInterval = setInterval(() => {
      index = (index + 1) % messages.length;
      this.aiStatusMessage.set(messages[index]);
    }, 3000);
  }

  private stopAiMessages(): void {
    if (this.aiMessageInterval) {
      clearInterval(this.aiMessageInterval);
      this.aiMessageInterval = null;
    }
  }
}

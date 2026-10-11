import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, DialogComponent, IconComponent } from '@ui';
import { Order, OrderBackup, OrderMapper } from '../../../domain';
import { OrderBackupService } from '../../../infrastructure/order-backup.service';
import { OrderExcelService } from '../../../infrastructure/order-excel.service';
import { OrderImportDraftService } from '../../../infrastructure/order-import-draft.service';

type HubView = 'hub' | 'upload' | 'backups' | 'backup-view';

/** Hub "Exportar / Importar órdenes" — modal multi-vista (espejo del de
 *  productos). Export lo maneja el padre (tiene los filtros) vía output. Import
 *  muestra una dropzone y navega al editor. Respaldos: snapshots de todas las
 *  órdenes para dar seguridad al cliente (crear a demanda, ver, descargar a
 *  Excel, y restaurar APPEND-ONLY las órdenes borradas). */
@Component({
  selector: 'lib-order-import-export-hub',
  standalone: true,
  imports: [
    DialogComponent,
    IconComponent,
    ButtonComponent,
    TranslocoPipe,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './order-import-export-hub.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderImportExportHubComponent {
  private readonly dialog = viewChild.required(DialogComponent);
  private readonly router = inject(Router);
  private readonly excel = inject(OrderExcelService);
  private readonly draftService = inject(OrderImportDraftService);
  private readonly backupService = inject(OrderBackupService);
  private readonly toast = inject(ToastService);

  /** Símbolo de la moneda de referencia (para el Excel de un respaldo). */
  public readonly currencySymbol = input('$');

  /** El usuario eligió exportar las órdenes a Excel (el padre tiene los filtros). */
  public readonly exportOrders = output<void>();
  /** Se recuperaron órdenes de un respaldo → el padre recarga el listado. */
  public readonly ordersRestored = output<void>();

  public readonly view = signal<HubView>('hub');
  /** True mientras se lee/parsea el Excel (spinner en la dropzone). */
  public readonly isParsing = signal(false);
  /** Resalta la dropzone mientras se arrastra un archivo encima. */
  public readonly isDragging = signal(false);

  // ── Respaldos ─────────────────────────────────────────────────────────────
  public readonly backups = signal<OrderBackup[]>([]);
  public readonly loadingBackups = signal(false);
  public readonly isCreatingBackup = signal(false);
  public readonly isRestoring = signal(false);
  public readonly viewingBackup = signal<OrderBackup | null>(null);
  public readonly backupOrders = signal<Order[]>([]);
  public readonly loadingBackupRows = signal(false);

  public open(): void {
    this.view.set('hub');
    this.isParsing.set(false);
    this.isDragging.set(false);
    this.dialog().show();
  }

  public close(): void {
    this.dialog().hide();
    this.view.set('hub');
    this.isParsing.set(false);
    this.isDragging.set(false);
  }

  protected onExport(): void {
    this.exportOrders.emit();
    this.close();
  }

  // ── Import ──────────────────────────────────────────────────────────────
  /** Muestra la vista de subida (dropzone), sin abrir el selector de archivo. */
  protected onImportClick(): void {
    this.view.set('upload');
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite re-subir el mismo archivo
    if (file) this.handleFile(file);
  }

  /** Parsea el Excel y, si sale bien, deja la orden en el draft y navega al
   *  editor de "crear orden" que la precarga para revisión. */
  private async handleFile(file: File): Promise<void> {
    if (this.isParsing()) return;
    this.isParsing.set(true);
    const result = await this.excel.parseOrderExcel(file);
    result.fold(
      (error) => {
        this.toast.error(new Exception(error.message));
        this.isParsing.set(false);
      },
      (parsed) => {
        this.draftService.set(parsed);
        this.close();
        this.router.navigate(['/admin/orders/create'], {
          queryParams: { import: '1' },
        });
      }
    );
  }

  // ── Respaldos ─────────────────────────────────────────────────────────────
  protected async openBackups(): Promise<void> {
    this.view.set('backups');
    await this.loadBackups();
  }

  private async loadBackups(): Promise<void> {
    this.loadingBackups.set(true);
    const res = await this.backupService.listBackups();
    res.fold(
      (error) => this.toast.error(new Exception(error.message)),
      (list) => this.backups.set(list)
    );
    this.loadingBackups.set(false);
  }

  protected async createBackupNow(): Promise<void> {
    if (this.isCreatingBackup()) return;
    this.isCreatingBackup.set(true);
    const res = await this.backupService.createBackup('manual');
    await res.fold(
      async (error) => this.toast.error(new Exception(error.message)),
      async () => {
        this.toast.success('Respaldo creado');
        await this.loadBackups();
      }
    );
    this.isCreatingBackup.set(false);
  }

  protected async viewBackup(backup: OrderBackup): Promise<void> {
    this.viewingBackup.set(backup);
    this.view.set('backup-view');
    this.loadingBackupRows.set(true);
    this.backupOrders.set([]);
    const res = await this.backupService.getSnapshot(backup.id);
    res.fold(
      (error) => this.toast.error(new Exception(error.message)),
      (rows) => this.backupOrders.set(OrderMapper.toDomainList(rows))
    );
    this.loadingBackupRows.set(false);
  }

  protected async downloadBackup(backup: OrderBackup): Promise<void> {
    const res = await this.backupService.getSnapshot(backup.id);
    res.fold(
      (error) => this.toast.error(new Exception(error.message)),
      (rows) => {
        const orders = OrderMapper.toDomainList(rows);
        this.excel
          .exportOrders(orders, this.currencySymbol())
          .fold(
            (error) => this.toast.error(new Exception(error.message)),
            () => this.toast.success(`${orders.length} órdenes exportadas a Excel`)
          );
      }
    );
  }

  /** Restaura APPEND-ONLY: repone solo las órdenes borradas del respaldo. Antes
   *  crea un respaldo de seguridad ('pre-restore') para que sea reversible. */
  protected async restoreBackup(backup: OrderBackup): Promise<void> {
    if (this.isRestoring()) return;
    const ok = confirm(
      'Vamos a recuperar las órdenes de este respaldo que ya no estén (borradas). Las órdenes actuales no se tocan. ¿Continuar?'
    );
    if (!ok) return;

    this.isRestoring.set(true);
    // Respaldo de seguridad antes de restaurar (best-effort).
    await this.backupService.createBackup('pre-restore');
    const res = await this.backupService.restoreBackup(backup.id);
    await res.fold(
      async (error) => this.toast.error(new Exception(error.message)),
      async (count) => {
        if (count > 0) {
          this.toast.success(`${count} órdenes recuperadas`);
          this.ordersRestored.emit();
        } else {
          this.toast.success('No había órdenes para recuperar (todo al día)');
        }
        await this.loadBackups();
      }
    );
    this.isRestoring.set(false);
  }
}

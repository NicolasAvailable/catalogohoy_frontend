import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { DialogComponent, IconComponent } from '@ui';
import { OrderExcelService } from '../../../infrastructure/order-excel.service';
import { OrderImportDraftService } from '../../../infrastructure/order-import-draft.service';

/** Hub "Exportar / Importar órdenes" — modal con dos pasos (espejo del de
 *  productos). El export lo maneja el padre (que tiene los filtros) vía output.
 *  El import muestra primero una vista con dropzone (arrastrar o subir el
 *  archivo); al soltar/elegir el Excel lo parsea, lo deja en el draft y navega
 *  al editor de "crear orden" que lo precarga (esa es la pantalla de revisión). */
@Component({
  selector: 'lib-order-import-export-hub',
  standalone: true,
  imports: [DialogComponent, IconComponent, TranslocoPipe],
  templateUrl: './order-import-export-hub.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderImportExportHubComponent {
  private readonly dialog = viewChild.required(DialogComponent);
  private readonly router = inject(Router);
  private readonly excel = inject(OrderExcelService);
  private readonly draftService = inject(OrderImportDraftService);
  private readonly toast = inject(ToastService);

  /** Vista actual del modal: elección (hub) o subida del archivo (upload). */
  public readonly view = signal<'hub' | 'upload'>('hub');
  /** True mientras se lee/parsea el Excel (muestra spinner en la dropzone). */
  public readonly isParsing = signal(false);
  /** Resalta la dropzone mientras se arrastra un archivo encima. */
  public readonly isDragging = signal(false);

  /** El usuario eligió exportar las órdenes a Excel (el padre tiene los filtros). */
  public readonly exportOrders = output<void>();

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
}

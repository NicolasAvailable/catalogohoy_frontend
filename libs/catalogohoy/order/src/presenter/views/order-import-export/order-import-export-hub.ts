import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { DialogComponent, IconComponent } from '@ui';
import { OrderExcelService } from '../../../infrastructure/order-excel.service';
import { OrderImportDraftService } from '../../../infrastructure/order-import-draft.service';

/** Hub "Exportar / Importar órdenes" — modal con dos acciones (espejo del de
 *  productos). El export lo maneja el padre (que tiene los filtros) vía output;
 *  el import es self-contained: parsea el Excel, lo deja en el draft y navega
 *  al editor de "crear orden" que lo precarga. */
@Component({
  selector: 'lib-order-import-export-hub',
  standalone: true,
  imports: [DialogComponent, IconComponent, TranslocoPipe],
  templateUrl: './order-import-export-hub.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderImportExportHubComponent {
  private readonly dialog = viewChild.required(DialogComponent);
  private readonly fileInput =
    viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly router = inject(Router);
  private readonly excel = inject(OrderExcelService);
  private readonly draftService = inject(OrderImportDraftService);
  private readonly toast = inject(ToastService);

  /** El usuario eligió exportar las órdenes a Excel (el padre tiene los filtros). */
  public readonly exportOrders = output<void>();

  public open(): void {
    this.dialog().show();
  }

  public close(): void {
    this.dialog().hide();
  }

  protected onExport(): void {
    this.exportOrders.emit();
    this.close();
  }

  /** Abre el selector de archivo para importar un pedido. */
  protected onImportClick(): void {
    this.fileInput().nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite re-subir el mismo archivo
    if (!file) return;

    const result = await this.excel.parseOrderExcel(file);
    result.fold(
      (error) => this.toast.error(new Exception(error.message)),
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

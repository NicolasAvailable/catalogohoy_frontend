import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  ConfirmDialogService,
  DialogComponent,
  IconComponent,
} from '@ui';
import { ImageGalleryService } from '../../../infrastructure';

type GalleryTab = 'products' | 'uploads';

/**
 * Galería para reusar imágenes ya subidas. Dos pestañas:
 *  - "En mis productos": fotos usadas en los productos del tenant.
 *  - "Todas las subidas": todas las imágenes registradas del tenant.
 * Click en una imagen → la emite por `selected` (el padre la agrega vía setPhoto).
 */
@Component({
  selector: 'lib-image-gallery',
  imports: [ButtonComponent, DialogComponent, IconComponent],
  templateUrl: './image-gallery.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGalleryComponent implements AfterViewInit {
  public readonly tenantId = input<number | null>(null);
  public readonly closed = output<void>();
  public readonly selected = output<string>();

  private readonly gallery = inject(ImageGalleryService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly dialog = viewChild<DialogComponent>('galleryDialog');

  /** URL que se está eliminando (para el spinner del botón). */
  public readonly deleting = signal<string | null>(null);
  /** URL en preview (lightbox de "Ver"). Null = cerrado. */
  public readonly previewUrl = signal<string | null>(null);

  public readonly tab = signal<GalleryTab>('products');
  public readonly productPhotos = signal<string[]>([]);
  public readonly uploads = signal<string[]>([]);
  public readonly loadingProducts = signal<boolean>(true);
  public readonly loadingUploads = signal<boolean>(true);

  public readonly images = computed(() =>
    this.tab() === 'products' ? this.productPhotos() : this.uploads()
  );
  public readonly loading = computed(() =>
    this.tab() === 'products' ? this.loadingProducts() : this.loadingUploads()
  );

  ngAfterViewInit(): void {
    this.dialog()?.show();
    this.load();
  }

  private async load(): Promise<void> {
    const tid = this.tenantId();
    if (!tid) {
      this.loadingProducts.set(false);
      this.loadingUploads.set(false);
      return;
    }
    this.gallery.listProductPhotos(tid).then((r) => {
      r.mapRight((urls) => this.productPhotos.set(urls));
      this.loadingProducts.set(false);
    });
    this.gallery.listUploads(tid).then((r) => {
      r.mapRight((urls) => this.uploads.set(urls));
      this.loadingUploads.set(false);
    });
  }

  public setTab(tab: GalleryTab): void {
    this.tab.set(tab);
  }

  /** Detecta si la URL es un video (para mostrar <video> en vez de <img>, que
   *  saldría roto). Los productos pueden tener videos en `photos`. */
  public isVideo(url: string): boolean {
    return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url);
  }

  public onDialogClose(): void {
    this.closed.emit();
  }

  public pick(url: string): void {
    this.selected.emit(url);
    this.dialog()?.hide();
  }

  public openPreview(url: string): void {
    this.previewUrl.set(url);
  }

  public closePreview(): void {
    this.previewUrl.set(null);
  }

  /** Elimina una imagen del sistema. Siempre confirma; si la imagen está usada
   *  en algún producto, avisa en el diálogo que se quitará también de ahí. */
  public async remove(url: string, event: Event): Promise<void> {
    event.stopPropagation();
    const tid = this.tenantId();
    if (!tid || this.deleting()) return;

    const usage = await this.gallery.countProductUsage(tid, url);
    const content =
      usage > 0
        ? `Esta imagen está en uso en ${usage} producto${
            usage === 1 ? '' : 's'
          }. Si la eliminás, se quitará también de ${
            usage === 1 ? 'ese producto' : 'esos productos'
          }. Esta acción no se puede deshacer.`
        : 'Vas a eliminar esta imagen de forma permanente. Esta acción no se puede deshacer.';

    this.confirm
      .warning({
        headerLabel: 'Eliminar imagen',
        contentLabel: content,
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        result.mapRight(async () => {
          this.deleting.set(url);
          const res = await this.gallery.deleteImage(tid, url);
          res
            .mapRight(() => {
              this.productPhotos.update((l) => l.filter((u) => u !== url));
              this.uploads.update((l) => l.filter((u) => u !== url));
              this.toast.success('Imagen eliminada');
            })
            .mapLeft((e) => this.toast.error(new Exception(e.message)));
          this.deleting.set(null);
        });
      });
  }
}

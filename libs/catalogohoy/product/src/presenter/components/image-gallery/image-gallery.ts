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
import { DialogComponent, IconComponent } from '@ui';
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
  imports: [DialogComponent, IconComponent],
  templateUrl: './image-gallery.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGalleryComponent implements AfterViewInit {
  public readonly tenantId = input<number | null>(null);
  public readonly closed = output<void>();
  public readonly selected = output<string>();

  private readonly gallery = inject(ImageGalleryService);
  private readonly dialog = viewChild<DialogComponent>('galleryDialog');

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

  public onDialogClose(): void {
    this.closed.emit();
  }

  public pick(url: string): void {
    this.selected.emit(url);
    this.dialog()?.hide();
  }
}

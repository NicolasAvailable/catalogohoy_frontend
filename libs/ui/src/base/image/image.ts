import { Component, input, ViewEncapsulation } from '@angular/core';
import { ImageModule } from 'primeng/image';

/** Ícono de descarga (lucide "download") para el botón inyectado en el toolbar
 *  del preview — inline porque el toolbar vive fuera del árbol de Angular. */
const DOWNLOAD_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

/**
 * Thin wrapper over PrimeNG `p-image`. Shows a thumbnail that, with
 * `preview` on (default), opens a full-screen zoomable preview on click —
 * https://primeng.org/image#preview. Lazy-loads by default.
 *
 * `styleClass` sizes/styles the thumbnail container; `imageClass` styles the
 * inner `<img>` (e.g. `object-cover`). `previewSrc` overrides the large image
 * shown in the overlay (defaults to `src`).
 */
@Component({
  selector: 'ui-image',
  standalone: true,
  imports: [ImageModule],
  template: `
    <p-image
      [src]="src()"
      [alt]="alt()"
      [preview]="preview()"
      [appendTo]="appendTo()"
      [loading]="lazy() ? 'lazy' : 'eager'"
      [imageClass]="imageClass()"
      [styleClass]="styleClass()"
      [previewImageSrc]="previewSrc() || src()"
      (onShow)="onPreviewShow()"
    />
  `,
  // None so the rule below reaches the preview overlay, which PrimeNG appends
  // to <body> (outside this component's encapsulation).
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
    /* Keep a margin around the full-screen preview instead of letting the
       image bleed to the viewport edges / under the toolbar. PrimeNG ships
       max-width/height: 100vw/vh at the same specificity, so !important is
       needed to win regardless of stylesheet order. */
    .p-image-original {
      max-width: calc(100vw - 6rem) !important;
      max-height: calc(100vh - 6rem) !important;
    }
  `,
  ],
})
export class ImageComponent {
  public readonly src = input.required<string>();
  public readonly alt = input<string>('');
  public readonly preview = input<boolean>(true);
  public readonly lazy = input<boolean>(true);
  public readonly imageClass = input<string>('');
  public readonly styleClass = input<string>('');
  public readonly previewSrc = input<string>('');
  /**
   * Where the full-screen preview overlay is appended. Defaults to `body` so
   * its fixed positioning escapes transformed ancestors (e.g. PrimeNG dialogs),
   * which otherwise trap the overlay and misplace its toolbar.
   */
  public readonly appendTo = input<unknown>('body');

  /** Agrega un botón de descarga al toolbar del preview. Apagado por defecto:
   *  solo lo piden vistas internas (p.ej. el chat del CRM) — el catálogo
   *  público y demás usos no cambian. */
  public readonly downloadable = input<boolean>(false);
  /** Nombre sugerido para el archivo descargado (default: el de la URL). */
  public readonly downloadName = input<string>('');

  /** PrimeNG no expone un slot para botones extra: al abrir el preview,
   *  inyectamos el botón en su toolbar (vive en la máscara colgada de <body>)
   *  copiando las clases de los botones nativos. Se destruye con la máscara. */
  protected onPreviewShow(): void {
    if (!this.downloadable()) return;
    setTimeout(() => {
      const toolbar = document.querySelector('.p-image-toolbar');
      if (!toolbar || toolbar.querySelector('.ui-image-download')) return;
      const nativeButton = toolbar.querySelector('button');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `${nativeButton?.className ?? 'p-image-action'} ui-image-download`;
      button.title = 'Descargar';
      button.innerHTML = DOWNLOAD_SVG;
      button.addEventListener('click', () => this.download());
      toolbar.prepend(button);
    });
  }

  private async download(): Promise<void> {
    const url = this.previewSrc() || this.src();
    const name =
      this.downloadName() || url.split('/').pop()?.split('?')[0] || 'imagen';
    try {
      // fetch → blob para forzar la descarga también en URLs cross-origin
      // (Storage de Supabase manda CORS abierto).
      const blob = await (await fetch(url)).blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = name;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  }
}

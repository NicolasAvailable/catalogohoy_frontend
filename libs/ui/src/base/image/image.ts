import { Component, input, ViewEncapsulation } from '@angular/core';
import { ImageModule } from 'primeng/image';

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
}

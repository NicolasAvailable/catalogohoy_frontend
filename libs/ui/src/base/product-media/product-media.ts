import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { isVideoUrl } from '@shared/domain';

/** Renders either `<img>` or `<video>` based on the URL extension. Used
 *  everywhere a product media slot can be either a photo or a video.
 *
 *  Defaults are tuned for the **detail view / modal**: `controls=true`
 *  with `preload="metadata"` so the browser only fetches the first few
 *  bytes (enough for the poster frame) until the user actually plays.
 *
 *  For grids/lists prefer passing a known image URL via
 *  `firstImageUrl(media)` so the heavy `<video>` element never renders.
 *  When that's not possible the component still works — videos will
 *  show their first frame via the browser's built-in poster logic. */
@Component({
  selector: 'ui-product-media',
  imports: [CommonModule],
  template: `
    @if (isVideo()) {
      <video
        [src]="url()"
        preload="metadata"
        playsinline
        [controls]="controls()"
        [muted]="muted()"
        [autoplay]="autoplay()"
        [loop]="loop()"
        [class]="styleClass()"
      ></video>
    } @else {
      <img
        [src]="url()"
        [alt]="alt()"
        [loading]="lazy() ? 'lazy' : 'eager'"
        [class]="styleClass()"
      />
    }
  `,
})
export class ProductMediaComponent {
  public readonly url = input.required<string>();
  public readonly alt = input<string>('');
  public readonly styleClass = input<string>('');
  public readonly controls = input<boolean>(true);
  public readonly muted = input<boolean>(true);
  public readonly autoplay = input<boolean>(false);
  public readonly loop = input<boolean>(false);
  public readonly lazy = input<boolean>(true);

  public readonly isVideo = computed(() => isVideoUrl(this.url()));
}

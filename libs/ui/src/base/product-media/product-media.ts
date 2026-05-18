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
 *  When that's not possible (product has only videos) you can pass
 *  `posterSeconds` to seek the video element to a non-zero frame —
 *  the browser then paints that frame instead of the often-black first
 *  one, which makes thumbnails actually readable. */
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
        (loadedmetadata)="onLoadedMetadata($event)"
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
  /** Seconds to seek the video to when used as a poster. Setting this to
   *  e.g. 1.5 makes thumbnails skip the typical black-fade first frame.
   *  Zero (default) leaves the browser-native first-frame behavior. */
  public readonly posterSeconds = input<number>(0);

  public readonly isVideo = computed(() => isVideoUrl(this.url()));

  protected onLoadedMetadata(event: Event): void {
    const seconds = this.posterSeconds();
    if (seconds <= 0) return;
    const video = event.target as HTMLVideoElement;
    if (!video) return;
    // Clamp to (duration - 0.1) so we never request a frame past the end,
    // which some browsers reject silently.
    const safeTarget = Math.min(seconds, Math.max(0, (video.duration || seconds) - 0.1));
    try {
      video.currentTime = safeTarget;
    } catch {
      /* seek can throw on cross-origin / unsupported codecs — swallow,
       * the browser still falls back to the first frame. */
    }
  }
}

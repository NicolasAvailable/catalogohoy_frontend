import { Component, computed, input } from '@angular/core';

/**
 * Poses disponibles de Todd, la mascota de CatalogoHoy.
 * Los archivos viven en `apps/catalogohoy/public/images/todd/todd-<pose>.webp`.
 */
export type ToddPose =
  | 'thumbs-up'
  | 'wave'
  | 'running'
  | 'celebrate'
  | 'pointing'
  | 'excel-pdf'
  | 'phone'
  | 'thinking'
  | 'apps-idea';

@Component({
  selector: 'ui-todd',
  host: { class: 'inline-block shrink-0' },
  template: `
    <img
      [src]="src()"
      alt="Todd"
      draggable="false"
      loading="lazy"
      decoding="async"
      class="block select-none pointer-events-none object-contain"
      [style.width.px]="size()"
      [style.height.px]="size()"
    />
  `,
})
export class ToddComponent {
  public readonly pose = input<ToddPose>('wave');
  public readonly size = input(140);

  protected readonly src = computed(() => `/images/todd/todd-${this.pose()}.webp`);
}

import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'ui-skeleton-list',
  imports: [CommonModule, SkeletonModule],
  template: `
    <section class="flex flex-wrap gap-6" [class]="styleClass()">
      @for (_ of items(); track $index) {
      <p-skeleton
        [width]="width()"
        [height]="height()"
        [borderRadius]="borderRadius()"
        [shape]="shape()"
        [animation]="animation()"
        [styleClass]="skeletonClass()"
        [ngClass]="{ 'w-full': width() === '100%' }"
        class="shrink-0 grow-0"
      />
      }
    </section>
  `,
})
export class SkeletonListComponent {
  public readonly count = input<number>(3);
  public readonly width = input<string>('100%');
  public readonly height = input<string>('1rem');
  public readonly borderRadius = input<string>('base');
  public readonly shape = input<'rectangle' | 'circle'>('rectangle');
  public readonly animation = input<'pulse' | 'wave' | 'none'>('pulse');
  public readonly skeletonClass = input<string>('');
  public readonly styleClass = input<string>('');

  public readonly items = computed(() => Array.from({ length: this.count() }));
}

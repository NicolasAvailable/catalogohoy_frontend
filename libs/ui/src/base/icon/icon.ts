import { Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Multimedia } from '@shared/domain';

@Component({
  selector: 'ui-icon',
  imports: [LucideAngularModule],
  template: `
    @if(isImage()) {
    <img [src]="name()" [alt]="alt()" [class]="styleClass()" />
    } @else {
    <lucide-angular [name]="name()" [size]="size()" [class]="styleClass()" />
    }
  `,
})
export class IconComponent {
  public readonly name = input('');
  public readonly size = input<number | string | undefined>(undefined);
  public readonly alt = input('');
  public readonly styleClass = input('');

  public readonly isImage = computed(() => new Multimedia(this.name()).isImage());
}

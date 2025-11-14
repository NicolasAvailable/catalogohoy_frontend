import { Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@shared/presenter';
import { IconComponent } from './icon';

@Component({
  selector: 'ui-icon-label',
  imports: [TranslatePipe, LucideAngularModule, IconComponent],
  template: `
    <span
      class="h-8 flex items-center gap-2.5 bg-grey-50 rounded-3xl py-2 px-3 text-sm text-grey-300 font-semibold"
      [class]="styleClass()"
    >
      <ui-icon [name]="icon()" styleClass="size-5 text-grey-300" />
      {{ label() | translate }}
    </span>
  `,
})
export class IconLabelComponent {
  public readonly label = input.required<string>();
  public readonly icon = input.required<string>();
  public readonly styleClass = input('');
}

import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import { ChipModule } from 'primeng/chip';
import { IconComponent } from '../icon';

@Component({
  selector: 'ui-chip',
  imports: [ChipModule, TranslatePipe, IconComponent],
  template: `
    <p-chip
      (onRemove)="remove.emit()"
      [label]="label() | translate"
      [removable]="removable()"
      class=""
      [styleClass]="
        (disabled() ? 'border-1 border-grey-100 !bg-grey-50 !text-grey-300 ' : 'border-1 border-grey-100 ') +
        'h-8 !font-display font-semibold ' +
        styleClass()
      "
    >
      @if (showIcon()) {
      <ui-icon [name]="icon()" styleClass="w-4 h-4 text-grey-300" />
      }
    </p-chip>
  `,
})
export class ChipComponent {
  public readonly label = input.required<string>();
  public readonly removable = input<boolean>(true);
  public readonly icon = input<string>('circle-check-big');
  public readonly styleClass = input<string>('');
  public readonly showIcon = input<boolean>(true);
  public readonly disabled = input<boolean>(false);

  public readonly remove = output<void>();
}

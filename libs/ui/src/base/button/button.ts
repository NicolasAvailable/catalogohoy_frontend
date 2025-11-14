import { Component, input } from '@angular/core';
import { ButtonModule, ButtonSeverity as ButtonSeverityType } from 'primeng/button';
import { TranslatePipe } from '@shared/presenter';
import { IconComponent } from '../icon/icon';

export type ButtonSeverity = ButtonSeverityType;

@Component({
  selector: 'ui-button',
  imports: [TranslatePipe, ButtonModule, IconComponent],
  template: `
    <p-button
      [label]="label() | translate"
      [variant]="variant()"
      [severity]="severity()"
      [icon]="icon()"
      [iconPos]="iconPos()"
      [loading]="isLoading()"
      [size]="size()"
      [fluid]="fluid()"
      [disabled]="disabled()"
      [styleClass]="styleClass()"
    >
      @let iconSize = size() === 'small' ? 'size-4!' : size() === 'large' ? 'size-6!' : 'size-5!';

      <ng-template #loadingicon>
        <ui-icon name="loaderCircle" [styleClass]="iconSize" class="shrink-0 animate-spin" />
      </ng-template>

      @if(icon() && !isLoading()) {
      <ui-icon [name]="icon()" [styleClass]="iconSize + ' ' + iconStyleClass()" class="shrink-0" />
      }
    </p-button>
  `,
})
export class ButtonComponent {
  public readonly label = input('');
  public readonly variant = input<'text' | 'outlined' | undefined>(undefined);
  public readonly severity = input<ButtonSeverity>(undefined);
  public readonly icon = input('');
  public readonly iconPos = input<'top' | 'bottom' | 'right' | 'left'>('left');
  public readonly size = input<'small' | 'large' | undefined>(undefined);
  public readonly isLoading = input(false);
  public readonly fluid = input(true);
  public readonly disabled = input(false);
  public readonly iconStyleClass = input('');
  public readonly styleClass = input('');
}

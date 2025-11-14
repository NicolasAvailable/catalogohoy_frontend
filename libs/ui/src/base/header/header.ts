import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import { IconComponent } from '../icon';

@Component({
  selector: 'ui-header',
  imports: [CommonModule, TranslatePipe, IconComponent],
  template: `
    <header [class]="'flex justify-between ' + styleClass()">
      <div [class]="'flex items-center gap-5 ' + contentStyleClass()">
        <span
          [class]="
            'w-14 h-14 flex items-center justify-center bg-white-700 rounded-full shrink-0 ' + backgroundStyleClass()
          "
        >
          <ui-icon [name]="icon()" [styleClass]="'w-8 h-8 text-primary-500 ' + iconStyleClass()" />
        </span>

        <h2 [class]="'font-bold text-3xl ' + labelStyleClass()">
          {{ label() | translate }}
        </h2>
      </div>

      <ng-content />
    </header>
  `,
})
export class HeaderComponent {
  public readonly icon = input('');
  public readonly label = input('');
  public readonly styleClass = input('');
  public readonly contentStyleClass = input('');
  public readonly backgroundStyleClass = input('');
  public readonly iconStyleClass = input('');
  public readonly labelStyleClass = input('');
}
